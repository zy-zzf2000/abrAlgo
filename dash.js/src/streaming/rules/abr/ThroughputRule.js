/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Dash Industry Forum.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  * Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */
import FactoryMaker from '../../../core/FactoryMaker.js';
import SwitchRequest from '../SwitchRequest.js';
import MetricsConstants from '../../constants/MetricsConstants.js';
import Debug from '../../../core/Debug.js';


function ThroughputRule(config) {

    config = config || {};
    let factory = dashjs.FactoryMaker;
    const context = this.context;
    const dashMetrics = config.dashMetrics;
    let PlaybackController = factory.getSingletonFactoryByName('PlaybackController');

    let instance,
        logger;

    let lastBitRate = 0;
    let lastLatency = 0;

    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
    }

    function getSwitchRequest(rulesContext) {
        console.log('using ThroughputRule');
        const mediaType = rulesContext.getMediaType();
        //计算QoE信息
        let httpRequest = dashMetrics.getCurrentHttpRequest(mediaType, true);
        let currentRepresentation = rulesContext.getRepresentation();
        let lastFragmentDownloadTime = (httpRequest.tresponse.getTime() - httpRequest.trequest.getTime()) / 1000;
        let segmentDuration = currentRepresentation.fragmentDuration;
        let currentBitrate = currentRepresentation.bandwidth;
        let currentBitrateKbps = currentBitrate / 1000.0;
        let segmentRebufferTime = lastFragmentDownloadTime > segmentDuration ? lastFragmentDownloadTime - segmentDuration : 0;
        let playbackController = PlaybackController(context).getInstance();
        let curLatency = playbackController.getCurrentLiveLatency();

        console.log('current BitRateKbps: ', currentBitrateKbps);
        console.log('last BitRateKbps: ', lastBitRate);
        console.log('segmentRebufferTime: ', segmentRebufferTime);
        console.log('latency: ', curLatency);
        let QoE = (Math.log(currentBitrateKbps) / Math.log(200)) - Math.abs(currentBitrateKbps - lastBitRate) / 1000 - (curLatency - lastLatency);
        console.log('QoE: ',QoE);
        lastBitRate = currentBitrateKbps;
        lastLatency = curLatency;

        const throughputController = rulesContext.getThroughputController();
        const throughput = throughputController.getSafeAverageThroughput(mediaType);
        console.log('current Throughput: ', throughput);
        try {
            const switchRequest = SwitchRequest(context).create();
            switchRequest.rule = this.getClassName();
            const mediaInfo = rulesContext.getMediaInfo();
            const mediaType = rulesContext.getMediaType();
            const currentBufferState = dashMetrics.getCurrentBufferState(mediaType);
            const scheduleController = rulesContext.getScheduleController();
            const abrController = rulesContext.getAbrController();
            const streamInfo = rulesContext.getStreamInfo();
            const streamId = streamInfo ? streamInfo.id : null;
            const isDynamic = streamInfo && streamInfo.manifestInfo ? streamInfo.manifestInfo.isDynamic : null;
            const throughputController = rulesContext.getThroughputController();
            const throughput = throughputController.getSafeAverageThroughput(mediaType);
            const latency = throughputController.getAverageLatency(mediaType);

            if (isNaN(throughput) || !currentBufferState) {
                return switchRequest;
            }

            if (abrController.getAbandonmentStateFor(streamId, mediaType) === MetricsConstants.ALLOW_LOAD) {
                if (currentBufferState.state === MetricsConstants.BUFFER_LOADED || isDynamic) {
                    switchRequest.representation = abrController.getOptimalRepresentationForBitrate(mediaInfo, throughput, true);
                    switchRequest.reason = {
                        throughput,
                        latency,
                        message:`[ThroughputRule]: Switching to Representation with bitrate ${switchRequest.representation ? switchRequest.representation.bitrateInKbit : 'n/a'} kbit/s. Throughput: ${throughput}`
                    };
                    scheduleController.setTimeToLoadDelay(0);
                }
            }

            return switchRequest;
        } catch (e) {
            logger.error(e);
            return SwitchRequest(context).create();
        }
    }

    function reset() {
        // no persistent information to reset
    }

    instance = {
        getSwitchRequest,
        reset
    };

    setup();

    return instance;
}

ThroughputRule.__dashjs_factory_name = 'ThroughputRule';
export default FactoryMaker.getClassFactory(ThroughputRule);
