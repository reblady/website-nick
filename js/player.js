// "Läuft gerade": what Nick is listening to on Spotify, from the Spotify data
// Lanyard passes along. A small retro player in the hero panel: the album
// cover shrunk to 24×24 pixels, title (scrolling when too long), artist,
// a segmented progress bar and the time. Hidden while nothing plays.

const ART = 24;

const player = document.getElementById('player');
const art = player.querySelector('.player__art');
const title = document.getElementById('playerTitle');
const artist = document.getElementById('playerArtist');
const fill = document.getElementById('playerFill');
const time = document.getElementById('playerTime');
const g = art.getContext('2d');

let track = null;
let ticker = null;
let coverUrl = '';

const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function tick() {
  if (!track) return;
  const { start, end } = track.timestamps;
  const elapsed = Math.min(end - start, Date.now() - start);
  fill.style.width = `${(elapsed / (end - start)) * 100}%`;
  time.textContent = `${clock(elapsed)} / ${clock(end - start)}`;
}

// Long titles scroll back and forth instead of being cut off.
function marquee() {
  const overflow = title.scrollWidth - title.parentElement.clientWidth;
  title.style.setProperty('--shift', `${Math.max(0, overflow)}px`);
  title.classList.toggle('is-scrolling', overflow > 0);
}

function drawCover(url) {
  if (url === coverUrl) return;
  coverUrl = url;
  g.clearRect(0, 0, ART, ART);
  if (!url) return;
  // No crossOrigin: the canvas only has to show the image, never read it.
  const img = new Image();
  img.onload = () => {
    if (url !== coverUrl) return;
    g.imageSmoothingEnabled = true;
    g.drawImage(img, 0, 0, ART, ART);
  };
  img.src = url;
}

export function showSpotify(spotify) {
  track = spotify && spotify.timestamps ? spotify : null;
  player.hidden = !track;
  clearInterval(ticker);
  if (!track) return;

  title.textContent = track.song;
  artist.textContent = track.artist.replace(/;/g, ',');
  player.href = track.track_id ? `https://open.spotify.com/track/${track.track_id}` : 'https://open.spotify.com';
  player.setAttribute('aria-label', `Läuft gerade auf Spotify: ${track.song} von ${artist.textContent}`);
  drawCover(track.album_art_url || '');
  tick();
  ticker = setInterval(tick, 1000);
  requestAnimationFrame(marquee);
}
