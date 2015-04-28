(function() {
    "use strict";

    window.me = {
        Machine: Machine,
        ENTRY_FUNC: "start",
        TEXT_START: 0x0100,
        STACK_START: 0x8000
    };


    function Machine() {
        this.regs = me.createRegisters();
        this.memory = new me.Memory();
        if (me.FD) {
            this.fd = new me.FD();
        }
        this.onCompleteListeners = [];
        this.onResetListeners = [];
        this.onClockListeners = [];
        this.isRunning = false;
    }


    Machine.prototype.reset = function () {
        this.regs.reset();
        this.memory.reset();

        this.regs.esp(me.STACK_START);
        this.regs.eip(this.entryAddr);

        this.notifyOnReset();
    };


    Machine.prototype.run = function (ms) {
        if (arguments.length === 0) {
            ms = 1000;
        }

        var f = (function (m) { return function() {
            stepRun(m);
        }; })(this);
        this.isRunning = true;
        this.runTimerId = setInterval(f, ms);
    };


    Machine.prototype.step = function () {
        if (this.isRunning) { return; }

        stepRun(this);
    };


    Machine.prototype.stop = function () {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        clearInterval(this.runTimerId);
        this.runTimerId = undefined;

        this.notifyOnComplete();
    };


    function stepRun(m) {
        var inst = m.getInstruction();

        if (inst && !inst.err()) {
            m.notifyOnClock();

            var addr = inst.exec(m);

            if (!addr) {
                addr = inst.addr() + inst.bytes().length;
            }

            if (inst.op() === "hlt") {
                return;
            }

            m.regs.eip(addr);
        } else {
            m.stop();
        }
    }


    Machine.prototype.setInstructions = function (instructions, textStart, ignoreLabelError) {
        if (arguments.length >= 2) {
            this.labels = me.link(instructions, textStart, ignoreLabelError);
        } else {
            this.labels = me.link(instructions, me.TEXT_START, ignoreLabelError);
        }

        this.instructions = instructions;

        if (arguments.length >= 2) {
            this.entryAddr = textStart;
        } else {
            var entry = this.labels[me.ENTRY_FUNC];

            if (entry) {
                this.entryAddr = entry.addr();
            } else {
                this.entryAddr = me.TEXT_START;
            }
        }

        var addr2inst = {};

        instructions.forEach(function (inst) {
            addr2inst[inst.addr()] = inst;
        });

        this.addr2inst = addr2inst;
    };


    Machine.prototype.getInstruction = function (addr) {
        if (arguments.length === 0) {
            addr = this.regs.eip();
        }

        return this.addr2inst[addr];
    };


    Machine.prototype.getLabelAddr = function (label) {
        var inst = this.labels[label];

        if (inst) {
            return inst.addr();
        }
    };


    Machine.prototype.addOnCompleteListener = function (listener) {
        this.onCompleteListeners.push(listener);
    };


    Machine.prototype.notifyOnComplete = function () {
        this.onCompleteListeners.forEach(function (listener) {
            listener();
        });
    };


    Machine.prototype.addOnResetListener = function (listener) {
        this.onResetListeners.push(listener);
    };


    Machine.prototype.notifyOnReset = function () {
        this.onResetListeners.forEach(function (listener) {
            listener();
        });
    };


    Machine.prototype.addOnClockListener = function (listener) {
        this.onClockListeners.push(listener);
    };


    Machine.prototype.notifyOnClock = function () {
        this.onClockListeners.forEach(function (listener) {
            listener();
        });
    };


    Machine.prototype.pop = function () {
        var esp = this.regs.esp;
        var val = this.memory.read32(esp());
        esp(esp() + 4);

        return val;
    };


    Machine.prototype.push = function (val, attr) {
        var esp = this.regs.esp;
        esp(esp() - 4);
        if (attr) {
            this.memory.setAttribute(esp(), attr);
        }
        this.memory.write32(esp(), val);
    };
})();
