// App registry (spec 3.4). The OS reaches every app screen through this object, and the screens
// get everything else (lists, drawing helpers, media) through the ScreenContext they are handed.
import { coverFlow } from './coverflow.js';
import { videos, videoPlayer } from './videos.js';
import { extras } from './extras.js';

export const apps = {
  coverFlow,                          // (ctx) => Screen, id 'coverflow'
  videos,                             // (ctx) => Screen, id 'videos'
  extras,                             // (ctx) => Screen, id 'extras'
  videoPlayer,                        // (ctx, video, { start, queue }) => Screen, id 'videoplayer'
};
