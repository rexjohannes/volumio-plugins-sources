'use strict';

const Parser = require('volumio-youtubei.js').Parser;
const PlaylistPanel = require('volumio-youtubei.js').YTNodes.PlaylistPanel;
const SectionList = require('volumio-youtubei.js').YTNodes.SectionList;
const TabbedSearchResults = require('volumio-youtubei.js').YTNodes.TabbedSearchResults;
const { InnerTubeParser, InnerTubeBaseModel } = require('./innertube');
const ytmusic = require(ytmusicPluginLibRoot + '/ytmusic');

class EndpointModel extends InnerTubeBaseModel {

  async getContents(endpoint, opts) {
    switch (endpoint.actionType) {
      case 'browse':
        return this._getBrowseContents(endpoint, opts);
      case 'search':
        return this._getSearchResults(endpoint, opts);
      case 'watch':
      case 'watchPlaylist':
        return this._getWatchContents(endpoint, opts);
      default:
        return Promise.resolve({});      
    }
  }

  async _getBrowseContents(endpoint, opts) {
    if (opts?.continuation) {
      return this.getBrowseResultsByContinuation(opts.continuation, endpoint.payload);
    }

    const innerTube = this.getInnerTube();
    const payload = { ...(endpoint.payload || {}), client: 'YTMUSIC' };
    const response = await innerTube.actions.execute('/browse', payload);
    const page = Parser.parseResponse(response.data);
    const sectionList = page.contents_memo.getType(SectionList)?.[0];
    await this.expandSectionList(sectionList);

    const fullData = {
      header: InnerTubeParser.unwrapItem(page.header),
      sections: sectionList.contents
    }

    return InnerTubeParser.parseFeed(fullData);
  }

  async _getSearchResults(endpoint, opts) {
    const payload = { client: 'YTMUSIC' };
    if (opts?.continuation) {
      payload.token = opts.continuation.token;
    }
    else {
      payload.query = endpoint.payload.query;
      
      if (endpoint.payload.params) {
        payload.params = endpoint.payload.params;
      }
    }

    const innerTube = this.getInnerTube();
    const response = await innerTube.actions.execute('/search', payload);
    const page = Parser.parseResponse(response.data);

    if (!opts?.continuation) {
      // Tabs: 'yt music', 'library'
      const tabs = page.contents_memo.getType(TabbedSearchResults)?.[0]?.tabs;

      // Selected tab indicates where the search was performed
      const selectedTab = tabs?.find((tab) => tab.selected);

      // Chips represent the searcheable item types (songs, albums, artists...)
      const chips = InnerTubeParser.unwrapItem(selectedTab?.content?.header)?.chips;

      // Array of sections containing the search results
      const searchResultSections = InnerTubeParser.unwrapArray(selectedTab?.content?.contents) || [];

      if (chips) {
        // Find 'reset filter' chip. It will be missing if no filter is selected. If it exists, then
        // it is the one without text, in which case we set its text to 'Everything'.
        const resetFilterChip = chips.find((chip) => !InnerTubeParser.unwrapText(chip.text));
        if (!resetFilterChip) {
          chips.unshift({
            is_selected: true,
            text: ytmusic.getI18n('YTMUSIC_NO_FILTERS'),
            endpoint: { // Need to convert back to InnerTube structure
              payload: endpoint.payload,
              metadata: {
                api_url: '/search'
              }
            }
          });
        }
        else {
          resetFilterChip.text = ytmusic.getI18n('YTMUSIC_NO_FILTERS');
        }

        // Ensure 'reset filter' chip is not selected if a filter is applied
        const selectedChips = chips.filter((chip) => chip.is_selected);
        if (selectedChips.length > 1 && resetFilterChip?.is_selected) {
          resetFilterChip.is_selected = false;
        }
      }

      // Create a section for chips and add to beginning of searchResultSections.
      // The chips will be converted to section's options
      searchResultSections.unshift({
        header: {
          chips
        }
      });

      const fullData = {
        sections: searchResultSections
      };

      const result = InnerTubeParser.parseFeed(fullData);

      // Convert tabs to option and add it to start items of the first 
      // section (the one we created with the chips)
      const tabsToOption = tabs && tabs.length > 1 ? InnerTubeParser.convertTabsToOption(tabs) : null;
      if (tabsToOption) {
        if (!result.sections[0].options) {
          result.sections[0].options = [];
        }
        result.sections[0].options.unshift(tabsToOption);
      }

      return result;
    }

    // Continuation results
    const data = page.continuation_contents;
    const fullData = {
      sections: [
        {
          ...(data || {}),
          isContinuation: true
        }
      ]
    };

    return InnerTubeParser.parseFeed(fullData);
  }

  async _getWatchContents(endpoint, opts) {
    const innerTube = this.getInnerTube();
    const payload = {
      playlistId: endpoint.payload.playlistId,
      client: 'YTMUSIC'
    };

    if (endpoint.payload.params) {
      payload.params = endpoint.payload.params;
    }

    if (endpoint.payload.videoId) {
      payload.videoId = endpoint.payload.videoId;
    }

    if (opts?.continuation) {
      payload.token = opts.continuation.token;
    }

    const response = await innerTube.actions.execute('/next', payload);
    const page = Parser.parseResponse(response.data);

    let contents;
    if (!opts?.continuation) {
      const playlistPanel = page?.contents_memo?.getType(PlaylistPanel)?.[0];
      contents = InnerTubeParser.parseSection(playlistPanel ? {
        ...playlistPanel,
        isWatch: true,
        playlistParams: payload.params
      } : {});
    }
    else { // Continuation contents
      const data = page.continuation_contents;
      const fullData = {
        // Continuation data does not return back the playlistId, so we specify it here
        playlist_id: payload.playlist_id,
        ...(data || {}),
        isContinuation: true,
        isWatch: true,
        playlistParams: payload.params
      };
      contents =  InnerTubeParser.parseSection(fullData);
    }

    // Look for AutomixPreviewVideo and separate that from contents.
    // Due to `InnerTubeParser#parseSection()`, automix items (AutomixPreviewVideo) will be placed
    // inside the section's `startItems` since they do not have thumbnails and have watchPlaylist
    // endpoints.
    const automixIndex = contents?.startItems?.findIndex((item) => item.type === 'automix');
    if (automixIndex >= 0) {
      contents.automix = contents.startItems.splice(automixIndex, 1)[0];
    }

    return contents;
  }
}

module.exports = EndpointModel;
