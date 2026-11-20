// S.P.I.E.S. radio player.
// Fill in the 8 tracks below: "title" is printed on the cassette label,
// "src" is the audio file in public/audio/. Reorder the lines to reorder the tracks.
const TRACKS = [
  { title: "Track 1", src: "audio/radio_pghEvents.mp3" },
  { title: "Track 2", src: "audio/radioCreaTeach_ScienceCenterFinal.mp3" },
  { title: "Track 3", src: "audio/radioCreaTeach_InventionlandFinal.mp3" },
  { title: "Track 4", src: "audio/radioCreaTeach_OpenLabFinal.mp3" },
  { title: "Track 5", src: "audio/radioCreaTeach_FluxspaceFinal.mp3" },
  { title: "Track 6", src: "audio/radioCreaTeach_TechnologyPlusRose.mp3" },
  { title: "Track 7", src: "audio/radioCreaTeach_TechPlusFinal.mp3" },
  { title: "Track 8", src: "audio/radio_red_ep2.mp3" },
];

const ICON_PLAY = "images/radio/play.png";
const ICON_PAUSE = "images/radio/Pause.png";

const player = document.getElementById("player");
const wrap = document.getElementById("cassette-wrap");
const label = document.getElementById("cassette-label");
const count = document.getElementById("track-count");
const seek = document.getElementById("seek");
const time = document.getElementById("time");
const status = document.getElementById("status");
const playBtn = document.getElementById("play");
const playIcon = document.getElementById("play-icon");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");

let index = 0;

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ":" + String(s).padStart(2, "0");
}

function updateTime() {
  const duration = player.duration;
  const hasDuration = isFinite(duration) && duration > 0;
  seek.disabled = !hasDuration;
  seek.value = hasDuration ? (player.currentTime / duration) * 100 : 0;
  time.textContent =
    formatTime(player.currentTime) + " / " + formatTime(hasDuration ? duration : 0);
}

function setPlayingUI(isPlaying) {
  wrap.classList.toggle("playing", isPlaying);
  playIcon.src = isPlaying ? ICON_PAUSE : ICON_PLAY;
  playBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
}

function loadTrack(i, autoplay) {
  index = (i + TRACKS.length) % TRACKS.length;
  const track = TRACKS[index];
  player.src = track.src;
  label.textContent = track.title;
  count.textContent = "Track " + (index + 1) + " of " + TRACKS.length;
  status.textContent = "";
  setPlayingUI(false);
  updateTime();
  if (autoplay) tryPlay();
}

function tryPlay() {
  const result = player.play();
  if (result && result.catch) {
    result.catch(() => {
      status.textContent = "Can't play this audio.";
      setPlayingUI(false);
    });
  }
}

playBtn.addEventListener("click", () => {
  if (player.paused) {
    tryPlay();
  } else {
    player.pause();
  }
});

prevBtn.addEventListener("click", () => loadTrack(index - 1, !player.paused));
nextBtn.addEventListener("click", () => loadTrack(index + 1, !player.paused));

seek.addEventListener("input", () => {
  if (isFinite(player.duration)) {
    player.currentTime = (seek.value / 100) * player.duration;
  }
});

player.addEventListener("play", () => { status.textContent = ""; setPlayingUI(true); });
player.addEventListener("pause", () => setPlayingUI(false));
player.addEventListener("ended", () => {
  player.currentTime = 0;
  setPlayingUI(false);
  updateTime();
});
player.addEventListener("loadedmetadata", updateTime);
player.addEventListener("timeupdate", updateTime);
player.addEventListener("error", () => {
  status.textContent = "Audio not found.";
  setPlayingUI(false);
  updateTime();
});

loadTrack(0, false);