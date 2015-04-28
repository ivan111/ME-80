(function () {
    "use strict";

    me.Assembler = Assembler;

    me.CC_CDECL = 1;
    me.CC_STDCALL = 2;


    var DIRECTIVES = ["org", "equ"];

    var RE_FUNC_CALL = /^\s*(?:([a-zA-Z_]\w*)(?::))?\s*([a-zA-Z_]\w*)\((.*)\)\s*$/;

    var RE_STR_LABEL = "^\\s*(?:([a-zA-Z_]\\w*)(?::))?";
    var RE_STR_OP = "([a-zA-Z]+)?";
    var RE_STR_ARG1 = "((?:[\\w\\[\\]\\-\\$]+|(?:\".*\")))?";
    var RE_STR_ARG2 = "(?:,\\s*([\\w\\[\\]]+))?";
    var RE_STR_COMMENT = "(?:(?:;)([^#]*))?";
    var RE_STR_MEMORY_COMMENT = "(?:(?:#)(.*))?$";

    var RE_LINE = new RegExp([RE_STR_LABEL, RE_STR_OP, RE_STR_ARG1, RE_STR_ARG2, RE_STR_COMMENT, RE_STR_MEMORY_COMMENT].join("\\s*"), "i");

    var RE_STR_DB_ARG = "([\\da-fx,]+)";
    var RE_DB_LINE = new RegExp([RE_STR_LABEL, "(db)", RE_STR_DB_ARG, RE_STR_COMMENT].join("\\s*"), "i");

    var PARSE_FUNCS = [[RE_FUNC_CALL, parseFuncCall],
                       [RE_DB_LINE, parseDBLine],
                       [RE_LINE, parseLine]];


    function Assembler() {
        this.instructions = [];
        this.consts = {};
        this.funcs = [];
        this.callingConvention = me.CC_CDECL;
    }


    Assembler.prototype.assemble = function (src) {
        var asm = this;
        var instructions = [];
        var lines;

        if (src.indexOf("\r") !== -1) {
            lines = src.split("\r\n");
        } else {
            lines = src.split("\n");
        }

        lines.forEach(function (line) {
            var insts = assembleLine(asm, line);

            insts.forEach(function (inst) {
                asm.instructions.push(inst);
                instructions.push(inst);
            });
        });

        return instructions;
    };


    function assembleLine(asm, line) {
        var result = parse(asm, line);
        var insts = [];

        result.forEach(function (m) {
            var op = m.op;

            if (op) {
                op = op.toLowerCase();
            }

            var isDirective = false;

            if (DIRECTIVES.indexOf(op) !== -1) {
                isDirective = true;
            }

            var constsArgs = [];

            for (var i = 0; i < m.args.length; i++) {
                var arg = m.args[i];

                if (arg in asm.consts) {
                    constsArgs.push({ i: i, src: arg });
                    m.args[i] = "" + asm.consts[arg];
                }
            }

            var inst = me.instruction.create(m.op, m.args, isDirective);

            if (op === "equ") {
                asm.consts[m.label] = inst.arg0.value(null);
            }

            if (constsArgs.length !== 0) {
                constsArgs.forEach(function (ca) {
                    inst.args()[ca.i].src(ca.src);
                });
            }

            inst
                .src(line)
                .label(m.label)
                .comment(m.comment)
                .memoryComment(m.memoryComment);

            insts.push(inst);
        });

        return insts;
    }


    function parse(asm, line) {
        for (var i = 0; i < PARSE_FUNCS.length; i++) {
            var arr = PARSE_FUNCS[i];
            var reParse = arr[0];
            var parseFunc = arr[1];

            var m = line.match(reParse);

            if (m) {
                return parseFunc(asm, m);
            }
        }

        throw "Invalid line: " + line;
    }


    function parseFuncCall(asm, m) {
        var funcName = m[2];

        var args = [];

        m[3].split(",").forEach(function (arg) {
            var s = String(arg).replace(/^\s+|\s+$/g, "");  // trim

            if (s !== "") {
                args.push(s);
            }
        });

        var result = [];

        args.forEach(function (arg, i) {
            var memoryComment = ["[", funcName, "] 引数", (i + 1)].join("");
            result.push({ label: "", op: "push", args: [arg], comment: "", memoryComment: memoryComment });
        });

        result.reverse();

        var funcStr = [funcName, "(", m[3], ")"].join("");
        result.push({ label: "", op: "call", args: [funcName], comment: funcStr, memoryComment: "" });

        if (asm.callingConvention === me.CC_CDECL && args.length !== 0) {
            result.push({ label: "", op: "add", args: ["esp", "" + (args.length * 4)], comment: "引数の後処理", memoryComment: "" });
        }

        if (m[1]) {
            result[0].label = m[1];
        }

        return result;
    }


    function parseDBLine(asm, m) {
        var result = {};
        var args = [];

        if (m[1]) { result.label = m[1]; }
        if (m[2]) { result.op = m[2]; }
        if (m[3]) { args.push(m[3]); }
        if (m[4]) { result.comment = m[4]; }

        result.args = args;

        return [result];
    }


    function parseLine(asm, m) {
        var result = {};
        var args = [];

        if (m[1]) { result.label = m[1]; }
        if (m[2]) { result.op = m[2]; }
        if (m[3]) { args.push(m[3]); }
        if (m[4]) { args.push(m[4]); }
        if (m[5]) { result.comment = m[5]; }
        if (m[6]) { result.memoryComment = m[6]; }

        result.args = args;

        return [result];
    }
}());
