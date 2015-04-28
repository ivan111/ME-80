(function() {
    "use strict";

    me.createRegisters = createRegisters;


    me.REG8_NAMES = ["ah", "al", "ch", "cl", "dh", "dl", "bh", "bl"];
    me.REG16_NAMES = ["ax", "cx", "dx", "bx", "si", "di", "bp", "sp", "ip"];
    me.REG32_NAMES = ["eax", "ecx", "edx", "ebx", "esi", "edi", "ebp", "esp", "eip"];
    me.SEGMENT_NAMES = ["cs", "ds", "es", "ss"];
    me.FLAG_NAMES = [ "sign", "zero", "carry" ];


    function createRegisters() {
        var listeners = {};
        createRegistersAccessor();


        function my() {
        }


        my.toString = function () {
            var vals = [];

            me.REG32_NAMES.forEach(function (name) {
                vals.push([name, this[name]()].join(":"));
            });

            return vals.join(", ");
        };


        my.addListener = function (reg, listener) {
            if (me.REG16_NAMES.indexOf(reg) !== -1) {
                reg = "e" + reg;
            }

            listeners[reg].push(listener);
        };


        my.reset = function () {
            me.REG32_NAMES.forEach(function (name) {
                my[name](0);
            });

            me.FLAG_NAMES.forEach(function (name) {
                my[name](false);
            });

            me.SEGMENT_NAMES.forEach(function (name) {
                my[name](0);
            });
        };


        function createRegistersAccessor() {
            me.REG32_NAMES.forEach(function (name) {
                createAccessor32(my, name, 0);
            });

            me.FLAG_NAMES.forEach(function (name) {
                createAccessorFlag(my, name, false);
            });

            me.SEGMENT_NAMES.forEach(function (name) {
                createAccessorSegment(my, name, 0);
            });

            me.REG16_NAMES.forEach(function (name) {
                createAccessor16(my, name);
            });

            me.REG8_NAMES.forEach(function (name) {
                createAccessor8(my, name);
            });
        }


        function createAccessorFlag(registers, name, val) {
            listeners[name] = [];

            registers[name] = function (v) {
                if (!arguments.length) {
                    return val;
                }

                var oldVal = val;

                if (v) {
                    val = true;
                } else {
                    val = false;
                }

                listeners[name].forEach(function (listener) {
                    listener(v, oldVal);
                });

                return registers;
            };
        }


        function createAccessorSegment(registers, name, val) {
            listeners[name] = [];

            registers[name] = function (v) {
                if (!arguments.length) {
                    return val;
                }

                if (v === parseInt(v)) {
                    var oldVal = val;
                    val = v & 0xFFFF;

                    listeners[name].forEach(function (listener) {
                        listener(v, oldVal);
                    });
                } else {
                    throw ["[Register Write Error] Invalid Register ", name.toUpperCase(), " Value: ", v].join("");
                }

                return registers;
            };
        }


        function createAccessor32(registers, name, val) {
            listeners[name] = [];

            registers[name] = function (v) {
                if (!arguments.length) {
                    return val;
                }

                if (v === parseInt(v)) {
                    var oldVal = val;
                    val = v & 0xFFFFFFFF;

                    listeners[name].forEach(function (listener) {
                        listener(v, oldVal);
                    });
                } else {
                    throw ["[Register Write Error] Invalid Register ", name.toUpperCase(), " Value: ", v].join("");
                }

                return registers;
            };
        }


        function createAccessor16(registers, name) {
            var reg32 = registers["e" + name];

            registers[name] = function (v) {
                if (!arguments.length) {
                    return reg32() & 0xFFFF;
                }

                if (v === parseInt(v)) {
                    var another = reg32() & 0xFFFF0000;
                    reg32(another | (v & 0xFFFF));
                } else {
                    throw ["[Register Write Error] Invalid Register ", name.toUpperCase(), " Value: ", v].join("");
                }

                return registers;
            };
        }


        function createAccessor8(registers, name) {
            var reg32 = registers["e" + name[0] + "x"];

            var isHigh;

            if (name[1] === "h") {
                isHigh = true;
            } else {
                isHigh = false;
            }

            registers[name] = function (v) {
                if (!arguments.length) {
                    if (isHigh) {
                        return (reg32() & 0xFF00) >> 8;
                    } else {
                        return reg32() & 0xFF;
                    }
                }

                if (v === parseInt(v)) {
                    var another;

                    if (isHigh) {
                        another = reg32() & 0xFFFF00FF;
                        reg32(another | ((v & 0xFF) << 8));
                    } else {
                        another = reg32() & 0xFFFFFF00;
                        reg32(another | (v & 0xFF));
                    }

                } else {
                    throw ["[Register Write Error] Invalid Register ", name.toUpperCase(), " Value: ", v].join("");
                }

                return registers;
            };
        }


        return my;
    }
})();
