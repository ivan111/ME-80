(function() {
    "use strict";

    me.FD = FD;


    function FD() {
        this.readListeners = [];
    }


    FD.prototype.read = function (h, c, s, num) {
        this.readListeners.forEach(function (listener) {
            listener(h, c, s, num);
        });
    };


    FD.prototype.addReadListener = function (listener) {
        this.readListeners.push(listener);
    };
})();
