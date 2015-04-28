(function () {
    "use strict";

    var ARG_REG8 = "r8";
    var ARG_REG16 = "r16";
    var ARG_REG32 = "r32";
    var ARG_SREG = "sreg";
    var ARG_RM = "r/m";
    var ARG_RM8 = "r/m8";
    var ARG_RM16 = "r/m16";
    var ARG_RM32 = "r/m32";
    var ARG_MEMORY = "mem";
    var ARG_IMM8 = "imm8";
    var ARG_IMM16 = "imm16";
    var ARG_IMM32 = "imm32";
    var ARG_LABEL = "lbl";
    var ARG_STR = "str";
    var ARG_ARR = "arr";

    me.instruction = {
        add: add,
        create: create,
        printInstructionClasses: printInstructionClasses,

        ARG_REG8: ARG_REG8,
        ARG_REG16: ARG_REG16,
        ARG_REG32: ARG_REG32,
        ARG_SREG: ARG_SREG,
        ARG_RM8: ARG_RM8,
        ARG_RM16: ARG_RM16,
        ARG_RM32: ARG_RM32,
        ARG_MEMORY: ARG_MEMORY,
        ARG_IMM8: ARG_IMM8,
        ARG_IMM16: ARG_IMM16,
        ARG_IMM32: ARG_IMM32,
        ARG_LABEL: ARG_LABEL,
        ARG_STR: ARG_STR,
        ARG_ARR: ARG_ARR
    };


    var REG8_NAMES = ["al", "ah", "ch", "cl", "dh", "dl", "bh", "bl"];
    var REG16_NAMES = ["ax", "cx", "dx", "bx", "sp", "bp", "si", "di", "cs", "ds", "es", "ss", "fs", "gs"];
    var REG32_NAMES = ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi"];
    var SREG_NAMES = ["cs", "ds", "es", "ss", "fs", "gs"];

    var REG2NUM = {
        al: 0, ax: 0, eax: 0,
        cl: 1, cx: 1, ecx: 1,
        dl: 2, dx: 2, edx: 2,
        bl: 3, bx: 3, ebx: 3,
        ah: 4, sp: 4, esp: 4,
        ch: 5, bp: 5, ebp: 5,
        dh: 6, si: 6, esi: 6,
        bh: 7, di: 7, edi: 7
    };

    var RE_FORM = /^\s*([a-zA-Z_]\w+)\s*([^,]+)?\s*(?:,\s*(\S+))?\s*$/;

    var RE_RM = /(r\/m(?:8|16|32))/;

    var RE_HEX_NUM_2 = /^[\dA-F]{2}$/;
    var RE_HEX_PLUS_REG = /^([\dA-F]{2})\+r[bwd]$/;
    var RE_OPCODE_EXT = /\/([0-7])/;

    var RE_STR = /^"(.*)"$/;
    var RE_RM_SI = /^\[si\]$/i;
    var RE_LABEL = /^([a-zA-Z_]\w+)$/;
    var RE_DEC_NUM = /^(\d+)$/;
    var RE_HEX_NUM = /^(?:0x)([\da-f]+)$/i;
    var RE_BIN_NUM = /^(?:0b)([01]+)$/i;
    var RE_NUM_ARRAY = /^(?:0b|0x)?[\da-f]+(\s*,\s*(?:0b|0x)?[\da-f]+)+$/i;

    var instructionClasses = {};



    function create(op, args, isDirective) {
        createAccessors(["src", "addr", "bytes", "label", "comment", "memoryComment", "err"]);

        if (!op) {
            op = "";
        }

        args.forEach(function (arg, i) {
            args[i] = createArg(arg);
            my["arg" + i] = args[i];
        });

        my.isDirective = isDirective;

        if (isDirective) {
            my.bytes([]);
        } else {
            var cls = get(op.toLowerCase(), args);

            if (cls) {
                var bytes = getBytes(cls, op, args);
                my.bytes(bytes);
                my.exec = cls.exec;
                my.cls = cls;

                setArgRmType(cls, args);
            } else {
                my.bytes([]);
                if (op !== "") {
                    my.err("invalid instruction");
                }
            }
        }


        function my() {
        }


        my.toString = function () {
            return my.src();
        };


        my.op = function () {
            return op;
        };


        my.args = function () {
            return args;
        };


        function createAccessors(names) {
            names.forEach(function (name) {
                createAccessor(my, name);
            });
        }


        function createAccessor(mine, name, val) {
            mine[name] = function (v) {
                if (!arguments.length) {
                    return val;
                }

                val = v;

                return mine;
            };
        }


        return my;
    }


    function setArgRmType(cls, args) {
        args.forEach(function (arg) {
            if (arg.type === ARG_RM) {
                var m = cls.form.match(RE_RM);

                if (!m) {
                    throw "not found r/m(8|16|32)";
                }

                if (m[1] === "r/m8") {
                    arg.type = ARG_RM8;
                } else if (m[1] === "r/m16") {
                    arg.type = ARG_RM16;
                } else {
                    arg.type = ARG_RM32;
                }
            }
        });
    }


    function getBytes(cls, op, args) {
        var bytes = cls.bytes.slice(0);

        // TODO: opcode ext

        if (cls.form === "resb imm32") {
            for (var i = 0; i < args[0].value(null); i++) {
                bytes.push(0);
            }
        } else if (cls.form === "db str") {
            bytes = str2bytes(args[0].str);
        } else if (cls.form === "db arr") {
            bytes = args[0].arr.slice(0);
        } else if (cls.form === "db imm8") {
            bytes = num2bytes(args[0].value(null), 1);
        } else if (cls.form === "dw imm16") {
            bytes = num2bytes(args[0].value(null), 2);
        } else if (cls.form === "dd imm32") {
            bytes = num2bytes(args[0].value(null), 4);
        }

        if (cls.opcodeArr[0].match(RE_HEX_PLUS_REG)) {
            bytes[0] += REG2NUM[args[0].regName];
        }

        return bytes;
    }


    function str2bytes(str) {
        var bytes = [];

        for (var i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
        }

        return bytes;
    }


    function createArg(argStr) {
        if (!argStr) {
            return {};
        }

        var lowArgStr = argStr.toLowerCase();

        if (SREG_NAMES.indexOf(lowArgStr) !== -1) {
            return new RegArg(ARG_SREG, lowArgStr).src(argStr);
        }

        if (REG8_NAMES.indexOf(lowArgStr) !== -1) {
            return new RegArg(ARG_REG8, lowArgStr).src(argStr);
        }

        if (REG16_NAMES.indexOf(lowArgStr) !== -1) {
            return new RegArg(ARG_REG16, lowArgStr).src(argStr);
        }

        if (REG32_NAMES.indexOf(lowArgStr) !== -1) {
            return new RegArg(ARG_REG32, lowArgStr).src(argStr);
        }

        if (startsWith(lowArgStr, "var_")) {
            return new RMArg("ebp", 0).varName(argStr.substr(4)).src("[ebp-@]");
        }

        if (startsWith(lowArgStr, "arg_")) {
            return new RMArg("ebp", 0).argName(argStr.substr(4)).src("[ebp+@]");
        }

        var m = argStr.match(RE_STR);

        if (m) {
            return new StringArg(m[1]).src(argStr);
        }

        m = argStr.match(RE_LABEL);

        if (m) {
            return new LabelArg(argStr).src(argStr);
        }

        m = argStr.match(RE_RM_SI);

        if (m) {
            return new RMArg("si", 0).src(argStr);
        }

        var n = str2num(argStr);

        if (n) {
            return new Imm32Arg(n.val, n.radix).src(argStr);
        }


        m = argStr.match(RE_NUM_ARRAY);

        if (m) {
            var db = argStr.split(",");
            var arr = [];

            for (var i = 0; i < db.length; i++) {
                var d = db[i];

                n = str2num(d);

                if (!n) {
                    return [];
                }

                arr.push(n.val);
            }

            return new ArrArg(arr).src(argStr);
        }

        return {};
    }


    function str2num(str) {
        var m = str.match(RE_DEC_NUM);

        if (m) {
            var v = parseInt(str, 10);
            return { val: v, radix: 10 };
        }

        m = str.match(RE_HEX_NUM);

        if (m) {
            v = parseInt(m[1], 16);
            return { val: v, radix: 16 };
        }

        m = str.match(RE_BIN_NUM);

        if (m) {
            v = parseInt(m[1], 2);
            return { val: v, radix: 2 };
        }

        return null;
    }


    function RegArg(type, regName) {
        this.type = type;
        this.regName = regName;
    }

    RegArg.prototype.value = function (m, v) {
        if (arguments.length === 0) {
            throw "no arg";
        }

        if (arguments.length === 1) {
            return m.regs[this.regName]();
        }

        m.regs[this.regName](v);

        return this;
    };

    RegArg.prototype.src = srcFunction;


    function RMArg(regName, disp) {
        this.type = ARG_RM;
        this.regName = regName;
        this.dispVal = disp;
    }

    RMArg.prototype.value = function (m, v) {
        if (this.type === ARG_RM) {
            throw "type must [r/m8 or r/m16 or r/m32]";
        }

        var addr = m.regs[this.regName]();
        addr += this.dispVal;

        if (arguments.length === 0) {
            throw "no arg";
        }

        if (arguments.length === 1) {
            return m.memory.read32(addr);
        }

        m.memory.write32(addr, v);

        return this;
    };

    RMArg.prototype.disp = function (v) {
        if (arguments.length === 0) {
            return this.dispVal;
        }

        this.dispVal = v;

        return this;
    };

    RMArg.prototype.argName = function (argNameStr) {
        if (arguments.length === 0) {
            return this.argNameStr;
        }

        this.argNameStr = argNameStr;

        return this;
    };

    RMArg.prototype.varName = function (varNameStr) {
        if (arguments.length === 0) {
            return this.varNameStr;
        }

        this.varNameStr = varNameStr;

        return this;
    };

    RMArg.prototype.src = srcFunction;


    function LabelArg(label) {
        this.type = ARG_LABEL;
        this.label = label;
    }

    LabelArg.prototype.value = function () {
        if (arguments.length === 0) {
            throw "no arg";
        }

        if (this.addr) {
            return this.addr;
        }

        return 0;
    };

    LabelArg.prototype.link = function (addr) {
        this.addr = addr;
    };

    LabelArg.prototype.src = srcFunction;


    function StringArg(str) {
        this.type = ARG_STR;
        this.str = str;
    }

    StringArg.prototype.value = function () {
        if (arguments.length === 0) {
            throw "no arg";
        }

        return this.str;
    };

    StringArg.prototype.src = srcFunction;


    function Imm32Arg(val, radix) {
        this.type = ARG_IMM32;
        this.val = val;
        this.radix = radix;
    }

    Imm32Arg.prototype.value = function (m, v) {
        if (arguments.length === 0) {
            throw "no arg";
        }

        if (arguments.length === 1) {
            return this.val;
        }

        this.val = v;

        return this;
    };

    Imm32Arg.prototype.src = srcFunction;


    function ArrArg(arr) {
        this.type = ARG_ARR;
        this.arr = arr;
    }

    ArrArg.prototype.value = function (m, v) {
        if (arguments.length === 0) {
            throw "no arg";
        }

        if (arguments.length === 1) {
            return this.arr;
        }

        this.arr = v;

        return this;
    };

    ArrArg.prototype.src = srcFunction;


    function srcFunction(src) {
        if (arguments.length === 0) {
            return this.srcStr;
        }

        this.srcStr = src;

        return this;
    }


    function add(inst) {
        var mangling = form2mangling(inst.form);

        if (!mangling) {
            throw "invalid form";
        }

        inst.opcodeArr = inst.opcode.split(" ");

        inst.bytes = opcode2bytes(inst.opcodeArr);

        var m = inst.opcode.match(RE_OPCODE_EXT);

        if (m) {
            inst.opcodeExt = parseInt(m[1]);
        }

        instructionClasses[mangling] = inst;
    }


    function form2mangling(form) {
        var m = form.match(RE_FORM);

        if (!m) {
            return null;
        }

        var op = m[1].toLowerCase();
        var arg1 = m[2] ? m[2].toLowerCase() : "";
        var arg2 = m[3] ? m[3].toLowerCase() : "";

        var args = [];
        if (arg1 !== "") { args.push(arg1); }
        if (arg2 !== "") { args.push(arg2); }

        return getManglingName(op, args);
    }


    function opcode2bytes(opcodeArr) {
        var bytes = [];

        opcodeArr.forEach(function (v) {
            if (v.match(RE_HEX_NUM_2)) {
                bytes.push(parseInt(v, 16));
            } else if (v.match(RE_HEX_PLUS_REG)) {
                var m = v.match(RE_HEX_PLUS_REG);
                bytes.push(parseInt(m[1], 16));
            } else if (v === "/r" ) {
                bytes.push(0);  // ModR/M
            } else if (v === "ib" || v === "cb") {
                bytes = bytes.concat([0]);
            } else if (v === "iw" || v === "cw") {
                bytes = bytes.concat([0, 0]);
            } else if (v === "id" || v === "cd") {
                bytes = bytes.concat([0, 0, 0, 0]);
            } else if (v.match(RE_OPCODE_EXT)) {
                bytes.push(0);  // ModR/M
            } else {
                throw "invalid opcode";
            }
        });

        return bytes;
    }


    function printInstructionClasses() {
        for (var mangling in instructionClasses) {
            var cls = instructionClasses[mangling];
            window.console.log(mangling, cls);
        }
    }


    function get(op, args) {
        var manglingNames = getManglingNames(op, args);

        for (var i = 0; i < manglingNames.length; i++) {
            var mangling = manglingNames[i];

            var cls = instructionClasses[mangling];

            if (cls) {
                return cls;
            }
        }

        return null;
    }


    function getManglingNames(op, args) {
        if (!op || op === "") {
            return [];
        }

        var argsTypes = [op].concat(args).map(function () { return []; } );
        argsTypes[0] = [op];

        args.forEach(function (arg, k) {
            var i = k + 1;

            if (arg.type === ARG_RM) {
                argsTypes[i].push(ARG_RM8);
                argsTypes[i].push(ARG_RM16);
                argsTypes[i].push(ARG_RM32);
            } else if (arg.type === ARG_IMM32 || arg.type === ARG_LABEL) {
                var val = arg.value(null);

                if (val <= 0xFF) {
                    argsTypes[i].push(ARG_IMM8);
                }

                if (val <= 0xFFFF) {
                    argsTypes[i].push(ARG_IMM16);
                }

                if (arg.type === ARG_LABEL) {
                    argsTypes[i].push(ARG_IMM32);
                }
            } else if (REG8_NAMES.indexOf(arg.regName) !== -1 ||
                       REG16_NAMES.indexOf(arg.regName) !== -1 ||
                       REG32_NAMES.indexOf(arg.regName) !== -1) {
                argsTypes[i].push(arg.regName);
            }

            argsTypes[i].push(args[k].type);
        });

        var cp = cartProd(argsTypes);

        var manglingNames = [];

        cp.forEach(function (d) {
            manglingNames.push(d.join("_"));
        });

        window.console.log();
        window.console.log(op, args);
        window.console.log(manglingNames);

        return manglingNames;
    }


    // http://stackoverflow.com/questions/12303989/cartesian-product-of-multiple-arrays-in-javascript
    function cartProd(paramArray) {
        function addTo(curr, args) {
            var copy;
            var rest = args.slice(1);
            var last = !rest.length;
            var result = [];

            for (var i = 0; i < args[0].length; i++) {

                copy = curr.slice();
                copy.push(args[0][i]);

                if (last) {
                    result.push(copy);

                } else {
                    result = result.concat(addTo(copy, rest));
                }
            }

            return result;
        }

        return addTo([], paramArray);
    }


    function getManglingName(op, args) {
        return [op].concat(args).join("_");
    }


    function num2bytes(val, len) {
        var result = [];

        for (var i = 0; i < len; i++) {
            result.push(val & 0xFF);
            val >>= 8;
        }

        return result;
    }


    /*
    function getRelativeAddr(baseAddr, addr) {
        return addr - baseAddr;
    }
    */


    function startsWith(s1, s2) {
        return s1.indexOf(s2) === 0;
    }

    add({ form: "db imm8", opcode: "ib", exec: execNop });
    add({ form: "db arr", opcode: "ib", exec: execNop });
    add({ form: "db str", opcode: "ib", exec: execNop });
    add({ form: "dw imm16", opcode: "iw", exec: execNop });
    add({ form: "dd imm32", opcode: "id", exec: execNop });
    add({ form: "resb imm32", opcode: "id", exec: execNop });


    add({ form: "nop", opcode: "90", exec: execNop });
    add({ form: "hlt", opcode: "F4", exec: function (m) { m.stop(); } });

    add({ form: "mov sreg, r16", opcode: "8E /r", exec: execMov });
    add({ form: "mov r16, r16", opcode: "89 /r", exec: execMov });
    add({ form: "mov r32, r32", opcode: "89 /r", exec: execMov });
    add({ form: "mov r/m32, r32", opcode: "89 /r", exec: execMov });
    add({ form: "mov r8, r/m8", opcode: "8A /r", exec: execMov });
    add({ form: "mov r16, sreg", opcode: "8C /r", exec: execMov });
    add({ form: "mov r16, r/m16", opcode: "8B /r", exec: execMov });
    add({ form: "mov r32, r/m32", opcode: "8B /r", exec: execMov });
    add({ form: "mov r8, imm8", opcode: "B0+rb ib", exec: execMov });
    add({ form: "mov r16, imm16", opcode: "B8+rw iw", exec: execMov });
    add({ form: "mov r32, imm32", opcode: "B8+rd id", exec: execMov });
    add({ form: "mov r/m32, imm32", opcode: "C7 /0", exec: execMov });

    add({ form: "add al, imm8", opcode: "04 ib", exec: execAdd });
    add({ form: "add ax, imm16", opcode: "05 iw", exec: execAdd });
    add({ form: "add eax, imm32", opcode: "05 id", exec: execAdd });
    add({ form: "add r8, imm8", opcode: "80 /0 ib", exec: execAdd });
    add({ form: "add r16, imm8", opcode: "83 /0 ib", exec: execAdd });
    add({ form: "add r16, imm16", opcode: "81 /0 iw", exec: execAdd });
    add({ form: "add r32, imm8", opcode: "83 /0 ib", exec: execAdd });
    add({ form: "add r32, imm32", opcode: "81 /0 id", exec: execAdd });
    add({ form: "add r32, r/m32", opcode: "03 /r", exec: execAdd });

    add({ form: "sub eax, imm32", opcode: "2D id", exec: execSub });
    add({ form: "sub esp, imm32", opcode: "81 /5 id", exec: execSubEsp });
    add({ form: "sub r32, imm32", opcode: "81 /5 id", exec: execSub });

    add({ form: "cmp r8, imm8", opcode: "80 /7 ib", exec: execCmp });
    add({ form: "cmp r16, imm8", opcode: "83 /7 ib", exec: execCmp });

    add({ form: "push r32", opcode: "50", exec: execPush });
    add({ form: "push imm32", opcode: "68 id", exec: execPush });
    add({ form: "pop r32", opcode: "58", exec: execPop });

    // TODO rel32, rel8
    add({ form: "jmp imm8", opcode: "EB cb", exec: execJmp });
    add({ form: "jmp imm32", opcode: "E9 cd", exec: execJmp });
    add({ form: "jz imm8", opcode: "74 cb", exec: execJz });
    add({ form: "je imm8", opcode: "74 cb", exec: execJz });
    add({ form: "jnz imm8", opcode: "75 cb", exec: execJnz });
    add({ form: "jb imm8", opcode: "72 cb", exec: execJb });
    add({ form: "jc imm8", opcode: "72 cb", exec: execJb });
    add({ form: "jbe imm8", opcode: "76 cb", exec: execJbe });
    add({ form: "ja imm8", opcode: "77 cb", exec: execJa });
    add({ form: "jae imm8", opcode: "73 cb", exec: execJae });
    add({ form: "jnc imm8", opcode: "73 cb", exec: execJae });

    add({ form: "call imm32", opcode: "E8 cd", exec: execCall });
    add({ form: "ret", opcode: "C3", exec: function (m) { return m.pop(); } });
    add({ form: "ret imm16", opcode: "C2 iw", exec: execRetIm });
    add({ form: "leave", opcode: "C9", exec: execLeave });
    add({ form: "int imm8", opcode: "CD ib", exec: execInt });


    function execNop() {
    }


    function execMov(m) {
        this.arg0.value(m, this.arg1.value(m));
    }


    function execAdd(m) {
        var val = this.arg0.value(m) + this.arg1.value(m);
        this.arg0.value(m, val);
    }


    function execSub(m) {
        var val = this.arg0.value(m) - this.arg1.value(m);
        this.arg0.value(m, val);
    }


    function execCmp(m) {
        var val = this.arg0.value(m) - this.arg1.value(m);

        if (val === 0) {
            m.regs.zero(true);
        } else {
            m.regs.zero(false);
        }

        if (val < 0) {
            m.regs.carry(true);
        } else {
            m.regs.carry(false);
        }
    }


    function execSubEsp(m) {
        var arg1Val = this.arg1.value(m);

        var comments = this.memoryComment().split("|");

        if (arg1Val / 4 === comments.length) {
            var esp = m.regs.esp;

            for (var i = 0; i < arg1Val / 4; i++) {
                var addr = esp() - ((i + 1) * 4);

                m.memory.setAttribute(addr, { funcId: this.funcId, comment: comments[i] });
                m.memory.write32(addr, m.memory.read32(addr));  // update comment
            }
        }

        var val = this.arg0.value(m) - arg1Val;
        this.arg0.value(m, val);
    }


     function execPush(m) {
        m.push(this.arg0.value(m), { funcId: this.funcId, comment: this.memoryComment() });
    }


    function execPop(m) {
        this.arg0.value(m, m.pop());
    }


    function execJmp(m) {
        return this.arg0.value(m);
    }


    function execJz(m) {
        if (m.regs.zero()) {
            return this.arg0.value(m);
        }
    }


    function execJnz(m) {
        if (m.regs.zero() === false) {
            return this.arg0.value(m);
        }
    }


    function execJb(m) {
        if (m.regs.carry()) {
            return this.arg0.value(m);
        }
    }


    function execJbe(m) {
        if (m.regs.carry() || m.regs.zero()) {
            return this.arg0.value(m);
        }
    }


    function execJa(m) {
        if (m.regs.carry() === false && m.regs.zero() === false) {
            return this.arg0.value(m);
        }
    }


    function execJae(m) {
        if (m.regs.carry() === false) {
            return this.arg0.value(m);
        }
    }


    function execCall(m) {
        var retAddr = this.addr() + this.bytes().length;

        var comment = ["[", this.arg0.label, "] call戻り先"].join("");
        m.push(retAddr, { funcId: this.funcId, comment: comment });

        return this.arg0.value(m);
    }


    function execRetIm(m) {
        var retAddr = m.pop();

        m.regs.esp(m.regs.esp() + this.arg0.value(m));

        return retAddr;
    }


    function execLeave(m) {
        m.regs.esp(m.regs.ebp());
        m.regs.ebp(m.pop());
    }


    function execInt(m) {
        if (this.arg0.value(m) !== 0x13) {
            throw "only int 0x13";
        }

        if (m.regs.dl() !== 0) {
            return;
        }

        var h = m.regs.dh();
        var c = m.regs.ch();
        var s = m.regs.cl() & 0x1F;
        var num = m.regs.al();

        m.fd.read(h, c, s, num);

        m.regs.carry(false);
        m.regs.ah(0);
    }
}());
