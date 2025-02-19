import yt2 from '../../../YouTube2Context';
import { ModelType } from '../../../model';
import Endpoint, { EndpointType } from '../../../types/Endpoint';
import PageContent from '../../../types/PageContent';
import WatchContent from '../../../types/WatchContent';
import Auth, { AuthStatus } from '../../../util/Auth';
import ExplodeHelper from '../../../util/ExplodeHelper';
import FeedViewHandler, { FeedView } from './FeedViewHandler';

// From InnerTube lib (YouTube.js#Actions)
const REQUIRES_SIGNIN_BROWSE_IDS = [
  'FElibrary',
  'FEhistory',
  'FEsubscriptions',
  'FEchannels',
  'FEmusic_listening_review',
  'FEmusic_library_landing',
  'SPaccount_overview',
  'SPaccount_notifications',
  'SPaccount_privacy',
  'SPtime_watched'
];

export interface GenericView extends FeedView {
  name: 'generic',
  endpoint?: Endpoint;
}

/**
 * Generic view handler. Contents fetched from endpoint with the EndpointModel.
 */

export default class GenericViewHandler<V extends Omit<GenericView, 'name'> & { name: string; } = GenericView> extends FeedViewHandler<V> {

  async browse() {
    const endpoint = this.getEndpoint();

    if (endpoint?.type === EndpointType.Browse &&
      REQUIRES_SIGNIN_BROWSE_IDS.includes(endpoint.payload.browseId) &&
      Auth.getAuthStatus().status !== AuthStatus.SignedIn) {
      yt2.toast('error', yt2.getI18n('YOUTUBE2_ERR_REQUIRE_SIGN_IN'));
      throw Error(yt2.getI18n('YOUTUBE2_ERR_REQUIRE_SIGN_IN'));
    }

    return super.browse();
  }

  protected async getContents(): Promise<PageContent> {
    const endpoint = this.assertEndpointExists(this.getEndpoint());
    const contents = await this.getModel(ModelType.Endpoint).getContents(endpoint);
    return this.assertPageContents(contents);
  }

  protected assertEndpointExists(endpoint?: Endpoint | null): Endpoint {
    if (!endpoint) {
      yt2.toast('error', yt2.getI18n('YOUTUBE2_ERR_ENDPOINT_INVALID'));
      throw Error(yt2.getI18n('YOUTUBE2_ERR_ENDPOINT_INVALID'));
    }
    return endpoint;
  }

  protected assertPageContents(content: PageContent | WatchContent | null): PageContent {
    if (content?.type !== 'page') {
      yt2.toast('error', yt2.getI18n('YOUTUBE2_ERR_ENDPOINT_INVALID'));
      throw Error(`Expecting page contents, but got ${content?.type}`);
    }
    return content;
  }

  protected async getTracksOnExplode() {
    const endpoint = this.getEndpoint(true);

    if (!endpoint || !endpoint.payload) {
      yt2.toast('error', yt2.getI18n('YOUTUBE2_ERR_OP_NOT_SUPPORTED'));
      throw Error(yt2.getI18n('YOUTUBE2_ERR_OP_NOT_SUPPORTED'));
    }

    const endpointPredicate = (endpoint: Endpoint) => endpoint.type === EndpointType.Watch && endpoint.payload?.playlistId;
    const model = this.getModel(ModelType.Endpoint);
    let targetWatchEndpoint: Endpoint | null = null;

    if (endpoint.type === EndpointType.Browse) {
      let contents = await model.getContents({...endpoint, type: endpoint.type});
      let tabs = contents?.tabs || [];
      if (tabs.length > 0) {
        // Remaining tabs that can be used to look for watch endpoints
        tabs = tabs.filter((tab) => !tab.selected && tab.endpoint?.type === EndpointType.Browse);
      }
      while (!targetWatchEndpoint) {
        targetWatchEndpoint = this.findAllEndpointsInSection(contents?.sections, endpointPredicate)[0];
        if (!targetWatchEndpoint) {
          const nextTab = tabs.shift();
          if (nextTab?.endpoint.type === EndpointType.Browse) {
            contents = await model.getContents({...nextTab.endpoint, type: endpoint.type});
          }
          else {
            break;
          }
        }
      }
    }
    else if (endpointPredicate(endpoint)) {
      targetWatchEndpoint = endpoint;
    }

    if (!targetWatchEndpoint) {
      yt2.toast('error', yt2.getI18n('YOUTUBE2_ERR_NO_PLAYABLE_ITEMS_FOUND'));
      throw Error('No playable items found');
    }

    const contents = await model.getContents({...targetWatchEndpoint, type: EndpointType.Watch});

    const result = contents?.playlist?.items?.filter((item) => item.type === 'video')
      .map((item) => ExplodeHelper.getExplodedTrackInfoFromVideo(item)) || [];

    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getEndpoint(explode = false): Endpoint | null {
    const view = this.currentView;
    if (view.continuation) {
      return view.continuation.endpoint;
    }
    return view.endpoint || null;
  }
}
