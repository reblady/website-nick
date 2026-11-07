// Live Discord presence from Lanyard (https://github.com/Phineas/lanyard) over
// its WebSocket, so status and Spotify update the moment they change. Falls
// back to asking the REST API once if the socket can't connect at all, and
// reconnects after a drop.

const SOCKET = 'wss://api.lanyard.rest/socket';
const RECONNECT_MS = 5000;

export function watchLanyard(userId, onPresence, onError) {
  let heartbeat = null;
  let gotData = false;

  async function fallback() {
    try {
      const res = await fetch(`https://api.lanyard.rest/v1/users/${userId}`);
      const json = await res.json();
      if (!json.success) throw new Error('Lanyard');
      gotData = true;
      onPresence(json.data);
    } catch (e) {
      onError();
    }
  }

  function connect() {
    let socket;
    try {
      socket = new WebSocket(SOCKET);
    } catch (e) {
      fallback();
      return;
    }
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      // Hello: start the heartbeat and subscribe to the user.
      if (message.op === 1) {
        heartbeat = setInterval(() => socket.send(JSON.stringify({ op: 3 })), message.d.heartbeat_interval);
        socket.send(JSON.stringify({ op: 2, d: { subscribe_to_id: userId } }));
      }
      if (message.op === 0 && (message.t === 'INIT_STATE' || message.t === 'PRESENCE_UPDATE')) {
        gotData = true;
        onPresence(message.d);
      }
    });
    socket.addEventListener('close', () => {
      clearInterval(heartbeat);
      if (!gotData) fallback();
      setTimeout(connect, RECONNECT_MS);
    });
  }

  connect();
}
