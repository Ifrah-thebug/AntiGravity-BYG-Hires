import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { env } from '@/core/config/env';

const VAPI_WEB_SDK = 'https://cdn.jsdelivr.net/npm/@vapi-ai/web@2.5.2/+esm';
const BASE_URL = env.webAppUrl || 'https://localhost';
/** Events the bridge page is allowed to send back to the app. */
const BRIDGE_EVENTS = new Set(['ready', 'call-start', 'call-end', 'speech-start', 'speech-end', 'transcript', 'error']);

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}
const BASE_ORIGIN = originOf(BASE_URL);

/** The bridge page must never navigate away (it holds the microphone): only its own origin. */
function allowNavigation(request) {
  const url = String(request?.url || '');
  if (request?.isTopFrame === false) return true; // iOS sub-frames used by the call SDK
  return url === 'about:blank' || url.startsWith('about:') || originOf(url) === BASE_ORIGIN;
}

/**
 * The web app uses @vapi-ai/web. To keep the exact same voice pipeline on mobile
 * (and avoid native WebRTC modules), the SDK runs inside an invisible WebView;
 * commands go in via injectJavaScript and events come back via postMessage.
 */
const BRIDGE_HTML = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body>
<script type="module">
  const post = (msg) => window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  const errMessage = (e) =>
    (e && (e.error && (e.error.message || e.error.msg))) || (e && e.message) || (typeof e === 'string' ? e : 'Voice call error');
  let vapi = null;

  async function ensureVapi(publicKey) {
    if (vapi) return vapi;
    const mod = await import('${VAPI_WEB_SDK}');
    const Vapi = mod.default || mod.Vapi;
    vapi = new Vapi(publicKey);
    vapi.on('call-start', () => post({ type: 'call-start' }));
    vapi.on('call-end', () => post({ type: 'call-end' }));
    vapi.on('speech-start', () => post({ type: 'speech-start' }));
    vapi.on('speech-end', () => post({ type: 'speech-end' }));
    vapi.on('error', (e) => post({ type: 'error', message: errMessage(e) }));
    vapi.on('message', (m) => {
      if (m && (m.type === 'transcript' || m.type === "transcript[transcriptType='final']")) {
        post({ type: 'transcript', role: m.role, transcript: m.transcript });
      }
    });
    return vapi;
  }

  window.__vapiCommand = async (cmd) => {
    try {
      if (cmd.type === 'start') {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const client = await ensureVapi(cmd.publicKey);
        await client.start(cmd.assistantId, cmd.overrides);
      } else if (cmd.type === 'stop') {
        if (vapi) vapi.stop();
      }
    } catch (e) {
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError');
      post({ type: 'error', code: denied ? 'MIC_DENIED' : undefined, message: errMessage(e) });
    }
  };

  post({ type: 'ready' });
</script>
</body></html>`;

const VapiBridge = forwardRef(function VapiBridge({ onEvent }, ref) {
  const webRef = useRef(null);

  useImperativeHandle(ref, () => ({
    send(cmd) {
      webRef.current?.injectJavaScript(`window.__vapiCommand && window.__vapiCommand(${JSON.stringify(cmd)}); true;`);
    },
  }));

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={webRef}
        source={{ html: BRIDGE_HTML, baseUrl: BASE_URL }}
        originWhitelist={['https://*', 'about:*']}
        onShouldStartLoadWithRequest={allowNavigation}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        onMessage={(e) => {
          const { data, url } = e.nativeEvent;
          // Only trust messages from the bridge page itself, and only known event types.
          if (url && originOf(url) !== BASE_ORIGIN) return;
          try {
            const event = JSON.parse(data);
            if (event && BRIDGE_EVENTS.has(event.type)) onEvent?.(event);
          } catch {
            /* ignore malformed */
          }
        }}
        onError={() => onEvent?.({ type: 'error', message: 'Could not load the voice interview engine. Check your internet connection.' })}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 },
});

export default VapiBridge;
