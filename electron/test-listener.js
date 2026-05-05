const { GlobalKeyboardListener } = require('node-global-key-listener');
const v = new GlobalKeyboardListener();
v.addListener(function (e, down) {
    if (e.state == "DOWN" && e.name == "LEFT CTRL") {
        console.log("Ctrl pressed");
    }
});
setTimeout(() => process.exit(0), 1000);
