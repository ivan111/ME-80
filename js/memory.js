(function() {
    "use strict";

    me.Memory = Memory;


    var MAX_ADDR = 0xFFFFFFFF;


    function Memory() {
        this.bytes = [];
        this.onChangeListeners = [];
    }


    Memory.prototype.reset = function () {
        this.bytes = [];
        this.attributes = [];
    };


    Memory.prototype.getAttribute = function (addr) {
        return this.attributes[addr];
    };


    Memory.prototype.setAttribute = function (addr, attr) {
        this.attributes[addr] = attr;
    };


    Memory.prototype.read8 = function (addr) {
        this.checkAddress(addr);
        this.checkUndefined(addr, 1);

        return this.bytes[addr];
    };


    Memory.prototype.read16 = function (addr) {
        this.checkAddress(addr);
        this.checkUndefined(addr, 2);

        var b0 = this.bytes[addr];
        var b1 = this.bytes[addr + 1];

        return b0 | (b1 << 8);
    };


    Memory.prototype.read32 = function (addr) {
        this.checkAddress(addr);
        this.checkUndefined(addr, 4);

        var b0 = this.bytes[addr];
        var b1 = this.bytes[addr + 1];
        var b2 = this.bytes[addr + 2];
        var b3 = this.bytes[addr + 3];

        return b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
    };


    Memory.prototype.write8 = function (addr, val) {
        this.checkAddress(addr);
        this.checkValue(addr, val, 0xFF);

        var oldVal = this.read8(addr);

        this.bytes[addr] = val & 0xFF;

        this.notifyOnChange(addr, val, oldVal);
    };


    Memory.prototype.write16 = function (addr, val) {
        this.checkAddress(addr);
        this.checkValue(addr, val, 0xFFFF);

        var oldVal = this.read16(addr);

        this.bytes[addr] = val & 0xFF;
        this.bytes[addr + 1] = (val >> 8) & 0xFF;

        this.notifyOnChange(addr, val, oldVal);
    };


    Memory.prototype.write32 = function (addr, val) {
        this.checkAddress(addr);
        this.checkValue(addr, val, 0xFFFFFFFF);

        var oldVal = this.read32(addr);

        this.bytes[addr] = val & 0xFF;
        this.bytes[addr + 1] = (val >> 8) & 0xFF;
        this.bytes[addr + 2] = (val >> 16) & 0xFF;
        this.bytes[addr + 3] = (val >> 24) & 0xFF;

        this.notifyOnChange(addr, val, oldVal);
    };


    Memory.prototype.addOnChangeListener = function (listener) {
        this.onChangeListeners.push(listener);
    };


    Memory.prototype.notifyOnChange = function (addr, val, oldVal) {
        this.onChangeListeners.forEach(function (listener) {
            listener(addr, val, oldVal);
        });
    };


    Memory.prototype.checkAddress = function (addr) {
        if (addr !== parseInt(addr) || addr < 0 || addr > MAX_ADDR) {
            throw ["[Memory Access Error] Invalid Address: ", addr].join("");
        }
    };


    Memory.prototype.checkUndefined = function (addr, length) {
        for (var i = addr; i < length; i++) {
            if (typeof this.bytes[i] === "undefined") {
                throw ["[Memory Read Error] attempted to read undefined value. (Address: ", i, ")"].join("");
            }
        }
    };


    Memory.prototype.checkValue = function (addr, val, maxVal) {
        if (val !== parseInt(val)) {
            throw ["[Memory Write Error] Invalid Value : ", val].join("");
        }

        if (val < 0 || val > maxVal) {
            throw ["[Memory Write Error] value must be less than or equal to ", maxVal.toString(16), ". (Address: ", addr, ", Value: ", val].join("");
        }
    };
})();
