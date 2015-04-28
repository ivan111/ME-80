(function () {
    "use strict";

    var RE_DEF = /^\s*([a-zA-Z_]\w*)\((.*)\)\s*(?:var\s+(.*))?\s*$/;

    var DEFAULT_CONF = {
        IS_ENTRY_POINT: false,
        USE_LEAVE: true
    };


    // def = "funcName(arg1, arg2) var var1, var2"
    me.Assembler.prototype.defun = function (def, conf, lines) {
        conf = me.mergeDict(DEFAULT_CONF, conf);

        var d = parseDef(def);
        this.funcs.push(d);

        var title = me.instruction.create("", []);
        title.isDefun = true;
        title.defun = def;

        var cc = this.callingConvention;

        var prolog;

        if (cc === me.CC_CDECL || cc === me.CC_STDCALL) {
            prolog = createProlog(this, d.name, d.args, d.vars);
        } else {
            prolog = [];
        }

        var instructions = this.assemble(lines);

        var epilog;

        if (conf.IS_ENTRY_POINT) {
            epilog = this.assemble("hlt");
        } else if (cc === me.CC_CDECL || cc === me.CC_STDCALL) {
            epilog = createEpilog(this, d.args, d.vars, conf, cc);
        } else {
            epilog = [];
        }

        var result = prolog.concat(instructions).concat(epilog);

        if (result.length > 0) {
            result[0].label(d.name);
        }

        setArgVar(result, d.args, d.vars);

        result = [title].concat(result);

        var funcId = this.funcs.length - 1;

        result.forEach(function (inst) {
            inst.func = d;
            inst.funcId = funcId;
        });

        return result;
    };


    function setArgVar(insts, args, vars) {
        insts.forEach(function (inst) {
            inst.args().forEach(function (arg) {
                if (arg.type === me.instruction.ARG_RM32) {
                    bindArgVar(inst, arg, args, vars);
                }
            });
        });
    }


    function bindArgVar(inst, arg, args, vars) {
        var n, disp, comment;

        var argName = arg.argName();
        var varName = arg.varName();

        if (argName) {
            n = args.indexOf(argName);

            if (n === -1) {
                inst.err("not found argument");
            } else {
                disp = (n + 1) * 4 + 4;
                arg.disp(disp);
                arg.src(["[ebp+", disp, "]"].join(""));

                comment = inst.comment();

                if (!comment) {
                    comment = "";
                } else if (comment !== "") {
                    comment += "  ";
                }

                comment += [arg.src(), " = 引数", n + 1, " ", argName].join("");
                inst.comment(comment);
            }
        } else if (varName) {
            n = vars.indexOf(varName);

            if (n === -1) {
                inst.err("not found variable");
            } else {
                disp = (n + 1) * 4;
                arg.disp(-disp);
                arg.src(["[ebp-", disp, "]"].join(""));

                comment = inst.comment();

                if (!comment) {
                    comment = "";
                } else if (comment !== "") {
                    comment += "  ";
                }

                comment += [arg.src(), " = 変数", n + 1, " ", varName].join("");
                inst.comment(comment);
            }
        }
    }


    function parseDef(def) {
        var m = def.match(RE_DEF);

        if (!m) {
            throw ("invalid defun");
        }

        var name = m[1];

        var args = commaSplit(m[2]);
        var vars = commaSplit(m[3]);

        return { name: name, args: args, vars: vars };
    }


    function commaSplit(str) {
        var arr = [];

        if (!str) {
            return arr;
        }

        str.split(",").forEach(function (a) {
            var s = String(a).replace(/^\s+|\s+$/g, "");

            if (s !== "") {
                arr.push(s);
            }
        });

        return arr;
    }


    function createProlog(asm, funcName, args, vars) {
        if (args.length === 0 && vars.length === 0) {
            return [];
        }

        var lines = [
            ["push ebp ; EBPの退避 # [", funcName, "] EBP退避"].join(""),
            "mov ebp, esp ; ESPの退避"
        ];

        if (vars.length !== 0) {
            lines.push(createVarsSub(funcName, vars));
        }

        return asm.assemble(lines.join("\n"));
    }


    function createVarsSub(funcName, vars) {
        var arr = [];

        arr.push("sub esp, ");
        arr.push(vars.length * 4);
        arr.push(" ; 変数の確保 #");

        vars.forEach(function (aVar, i) {
            if (i !== 0) {
                arr.push("|");
            }

            arr.push("[");
            arr.push(funcName);
            arr.push("] 変数");
            arr.push(i + 1);
            arr.push(" ");
            arr.push(aVar);
        });

        return arr.join("");
    }


    function createEpilog(asm, args, vars, conf, callingConvention) {
        if (args.length === 0 && vars.length === 0) {
            return asm.assemble("ret");
        }

        var lines;

        if (conf.USE_LEAVE) {
            lines = ["leave"];
        } else {
            lines = [
                "mov esp, ebp ; ESPの復元",
                "pop ebp ; EBPの復元"
            ];
        }

        if (callingConvention === me.CC_STDCALL) {
            lines.push("ret " + (args.length * 4));
        } else {
            lines.push("ret");
        }

        return asm.assemble(lines.join("\n"));
    }
})();
