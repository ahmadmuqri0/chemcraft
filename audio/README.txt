Put your sound files here with these exact names (mp3 shown; change the paths in
js/audio.js -> DEFAULT_TRACKS if you use .wav or other names):

  bgm.mp3      background music, loops (starts after the first click/tap)
  click.mp3    any button
  pickup.mp3   tile lifted from tray or board
  snap.mp3     tile snaps onto a hex cell
  bond.mp3     a group of tiles becomes stable
  error.mp3    invalid drop
  success.mp3  level complete
  step.mp3     next step in the synthesis popup

Until a file exists, each sound effect plays a short synthesised tone instead,
and music stays silent. Music and effects can be toggled from the top bar.
