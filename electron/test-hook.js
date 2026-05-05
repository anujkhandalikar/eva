const { uIOhook, UiohookKey } = require('uiohook-napi');
console.log('Hook starting...');
uIOhook.on('keyup', (e) => {
  console.log('keyup', e.keycode);
  if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) {
     console.log('Ctrl pressed!');
     process.exit(0);
  }
});
uIOhook.start();
setTimeout(() => {
  console.log('Timeout');
  process.exit(0);
}, 2000);
