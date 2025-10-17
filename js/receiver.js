
const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();
const options = new cast.framework.CastReceiverOptions();
const castDebugLogger = cast.debug.CastDebugLogger.getInstance();

options.customNamespaces = {};

context.addEventListener(cast.framework.system.EventType.READY, () => {
    if (!castDebugLogger.debugOverlayElement_) {
        // Enable debug logger and show a 'DEBUG MODE' overlay at top left corner.
        castDebugLogger.setEnabled(true);
        // Show debug overlay
        //castDebugLogger.showDebugLogs(true);
    }
});

// send signal to local player that the current stream has finished
playerManager.addEventListener(
    cast.framework.events.EventType.MEDIA_FINISHED,
    event => {
        if (event && event.endedReason === 'END_OF_STREAM') {
            context.sendCustomMessage('urn:x-cast:com.radiantmediaplayer.cast', undefined, {
                type: 'STATUS',
                message: 'MEDIA_FINISHED'
            });
        }
    }
);
let media = {};

playerManager.addEventListener(
    cast.framework.events.EventType.PLAYER_LOAD_COMPLETE, () => {
        const audioTracksManager = playerManager.getAudioTracksManager();
        const  textTracksManager = playerManager.getTextTracksManager();

        if(media.customData && media.customData.audio_language)
            audioTracksManager.setActiveByLanguage(media.customData.audio_language)
        if(media.customData && media.customData.subs_language)
            textTracksManager.setActiveByLanguage(media.customData.subs_language)
    });

// on LOAD adjust behaviour of CAF receiver
playerManager.setMessageInterceptor(
    cast.framework.messages.MessageType.LOAD,
    request => {
        if (request.media && request.media.customData) {
            if (request.media.customData.isLive) {
                request.media.streamType = cast.framework.messages.StreamType.LIVE;
                // for live stream - disable seek as we do not support DVR stream on Google Cast yet
                playerManager.removeSupportedMediaCommands(cast.framework.messages.Command.SEEK, true);
                playerManager.setMessageInterceptor(
                    cast.framework.messages.MessageType.SEEK,
                    seekData => {
                        // if the SEEK supported media command is disabled, block seeking
                        if (!(playerManager.getSupportedMediaCommands() && cast.framework.messages.Command.SEEK)) {
                            return null;
                        }
                        return seekData;
                    });
            }
            // DRM
            if (request.media.customData.mediaItem.drmConfiguration.licenseUri){
                playerManager.setMediaPlaybackInfoHandler((loadRequest, playbackConfig) => {
                    playbackConfig.protectionSystem = cast.framework.ContentProtection.WIDEVINE;
                    playbackConfig.licenseUrl = request.media.customData.mediaItem.drmConfiguration.licenseUri;
                    return playbackConfig;
                });
            }
        }

        request.media.contentId = request.media.contentId.replace("aac-all", "aac-st");
        request.media.contentId = request.media.contentId.replace("/aac/", "/st/");

        media = request.media;
        return request;
    }
);

context.start(options);
