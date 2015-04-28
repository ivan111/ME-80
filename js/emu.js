(function() {
    "use strict";

    window.Emulator = Emulator;


    var REGS = ["eax", "ecx", "edx", "ebx", "ebp", "esp", "eip"];
    var FLAGS = ["sign", "zero", "carry"];
    var STACK_REGS = ["ebp", "esp"];

    var DEFAULT_CONF = {
        DISPLAY_REGS: REGS,
        DISPLAY_FLAGS: FLAGS,
        STACK_START: 0x8000,
        DISPLAY_STACK_BYTES: 32,
        PANEL_VERTICAL: false,
        RUN_HZ: 1,
        SHOW_STACK: true,
        SHOW_BREAKPOINT: false,
        SHOW_BYTES: false,
        SHOW_REGISTERS: true,
        SHOW_TEXT_LABEL: true,
        SHOW_STACK_ESP: true,
        SHOW_STACK_EBP: true,
        SHOW_RUN_BUTTON: true,
        PLUGINS: []
    };

    var isRunning = false;

    var breakpoints = [];


    /*
     * conf = {
     *   DISPLAY_STACK_BYTES:
     * }
     */
    function Emulator($container, machine, conf) {
        conf = me.mergeDict(DEFAULT_CONF, conf);

        createControlPanel($container, machine, conf);

        if (conf.SHOW_REGISTERS) {
            createRegisterPanel($container, machine, conf);
        }

        createTextSectionTable($container, machine, conf);

        if (conf.SHOW_STACK) {
            createStackTable($container, machine, conf);
        }

        machine.reset();

        conf.PLUGINS.forEach(function (plugin) {
            plugin($container, machine, conf);
        });
    }


    function createControlPanel($container, machine, conf) {
        var $div = $("<div></div>").addClass("control-panel");

        var $stepButton = $("<input type='button' value='ステップ実行' />");
        $stepButton.click(function () { machine.step(); });
        $div.append($stepButton);

        if (conf.SHOW_RUN_BUTTON) {
            var $runButton = $("<input type='button' value='実行（" + conf.RUN_HZ + "Hz）' />");
            $runButton.click(function () {
                if (isRunning) {
                    isRunning = false;
                    machine.stop();
                    $runButton.attr("value", "実行（" + conf.RUN_HZ + "Hz）");
                } else {
                    isRunning = true;
                    machine.run(1000 / conf.RUN_HZ);
                    $runButton.attr("value", "停止");
                }
            });
            $div.append($runButton);

            machine.addOnCompleteListener(function () {
                if (isRunning) {
                    isRunning = false;
                    $runButton.attr("value", "実行（" + conf.RUN_HZ + "Hz）");
                }
            });

            machine.addOnResetListener(function () {
                if (isRunning) {
                    isRunning = false;
                    machine.stop();
                    $runButton.attr("value", "実行（" + conf.RUN_HZ + "Hz）");
                }
            });

            machine.regs.addListener("eip", function (val) {
                if (isRunning && breakpoints.indexOf(val) !== -1) {
                    isRunning = false;
                    machine.stop();
                    $runButton.attr("value", "実行（" + conf.RUN_HZ + "Hz）");
                }
            });
        }

        var $resetButton = $("<input type='button' value='リセット' />");
        $resetButton.click(function () { machine.reset(); });
        $div.append($resetButton);

        $container.append($div);
    }


    function createRegisterPanel($container, machine, conf) {
        var $div = $("<div></div>").addClass("registers-panel");
        var $div2 = $("<div></div>").css("display", "inline-block");
        $div.append($div2);

        var $fieldset = $("<fieldset><legend>レジスタ</legend></fieldset>");
        $div2.append($fieldset);


        conf.DISPLAY_REGS.forEach(function (reg) {
            var $regDiv = $("<div></div>").addClass("register");
            $regDiv.html([reg.toUpperCase(), ": "].join(""));
            var $reg = $("<span></span>").addClass("reg-" + reg).text("00000000");
            $regDiv.append($reg);
            $fieldset.append($regDiv);

            machine.regs.addListener(reg, function (val) {
                $reg.text(num2hex(val, 4));
                $reg.addClass("changed-value");
            });

            machine.addOnClockListener(function () {
                $reg.removeClass("changed-value");
            });

            machine.addOnResetListener(function () {
                $reg.removeClass("changed-value");
            });
        });


        conf.DISPLAY_FLAGS.forEach(function (reg) {
            var $regDiv = $("<div></div>").addClass("register");
            $regDiv.html([reg.toUpperCase(), ": "].join(""));
            var $reg = $("<span></span>").addClass("reg-" + reg).text("OFF");
            $regDiv.append($reg);
            $fieldset.append($regDiv);

            machine.regs.addListener(reg, function (val) {
                if (val) {
                    $reg.text("ON");
                } else {
                    $reg.text("OFF");
                }

                $reg.addClass("changed-value");
            });

            machine.addOnClockListener(function () {
                $reg.removeClass("changed-value");
            });

            machine.addOnResetListener(function () {
                $reg.removeClass("changed-value");
            });
        });


        $container.append($div);
    }


    function createTextSectionTable($container, machine, conf) {
        var $fieldset = $("<fieldset><legend>.TEXT</legend></fieldset>").addClass("text-section");
        var $div = $("<div></div>").addClass("text-section-div");
        $fieldset.append($div);

        var $table = $("<table></table>");
        $table.append("<tr>" +
                (conf.SHOW_BREAKPOINT ? "<th></th>" : "") +
                (conf.SHOW_TEXT_LABEL ? "<th>ラベル</th>" : "") +
                "<th>アドレス</th>" +
                (conf.SHOW_BYTES ? "<th>データ</th>" : "") +
                "<th>命令</th><th>引数１</th><th>引数２</th><th>コメント</th></tr>");

        var colNum = 7;
        if (!conf.SHOW_TEXT_LABEL) { colNum--; }
        if (!conf.SHOW_BYTES) { colNum--; }

        machine.instructions.forEach(function (inst) {
            var $row;
            var err = inst.err();

            if (inst.isDefun) {
                $row = $(["<tr><td colspan='", colNum, "' style='border-top: 2px solid #000; font-weight: bold;'>", inst.defun, "</td></tr>"].join(""));
            } else {
                var arg1 = formatArg(inst, 0);
                var arg2 = formatArg(inst, 1);

                var rowArr = [];
                rowArr.push("<tr>");
                if (conf.SHOW_BREAKPOINT) {
                    rowArr.push("<td><input type='checkbox'></input></td>");
                }
                if (conf.SHOW_TEXT_LABEL) {
                    rowArr.push("<td class='ts-label'>");
                    rowArr.push(inst.label());
                    rowArr.push("</td>");
                }
                rowArr.push("<td>");
                if (inst.bytes().length === 0) {
                    rowArr.push("");
                } else {
                    rowArr.push(num2hex(inst.addr(), 2));
                }
                if (conf.SHOW_BYTES) {
                    rowArr.push("</td><td>");
                    rowArr.push(bytes2str(inst.bytes()));
                }
                rowArr.push("</td><td class='ts-op'>");
                rowArr.push(inst.op());
                rowArr.push("</td><td>");
                rowArr.push(arg1);
                rowArr.push("</td><td>");
                rowArr.push(arg2);
                rowArr.push("</td><td>");
                rowArr.push(err ? err : inst.comment());
                rowArr.push("</td></tr>");

                $row = $(rowArr.join(""));
            }

            if (err) {
                $row.addClass("error");
            } else {
                $row.addClass("function-" + inst.funcId);
            }

            $table.append($row);

            inst.$row = $row;
        });

        $div.append($table);

        $container.append($fieldset);

        addRegListenerText(machine);

        $table.find("input[type=checkbox]").click(function () {
            breakpoints = [];

            $table.find("input[type=checkbox]").each(function (i) {
                if (this.checked) {
                    var inst = machine.instructions[i];
                    var addr = inst.addr();

                    if (addr) {
                        breakpoints.push(addr);
                    }
                }
            });
        });
    }


    function addRegListenerText(machine) {
        machine.regs.addListener("eip", function (val, oldVal) {
            var inst = machine.getInstruction(oldVal);
            if (inst) {
                inst.$row.removeClass("activated");
            }

            inst = machine.getInstruction(val);
            if (inst) {
                inst.$row.addClass("activated");
            }
        });
    }


    function formatArg(inst, pos) {
        var arg = inst.args()[pos];

        if (!arg) { return "　"; }

        var type = arg.type;
        var result;

        if (type === me.instruction.ARG_REG8 ||
            type === me.instruction.ARG_REG16 ||
            type === me.instruction.ARG_REG32) {
            result = ["<span class='ts-reg'>", arg.src(), "</span>"].join("");
        } else if (type === me.instruction.ARG_SREG) {
            result = ["<span class='ts-reg'>", arg.src(), "</span>"].join("");
        } else if (type === me.instruction.ARG_RM8 ||
                   type === me.instruction.ARG_RM16 ||
                   type === me.instruction.ARG_RM32) {
            if (arg.disp() === 0) {
                result = ["[<span class='ts-reg'>", arg.regName, "</span>]"].join("");
            } else if (arg.disp() > 0) {
                result = ["[<span class='ts-reg'>", arg.regName, "</span> + <span class='ts-im'>", arg.disp(), "</span>]"].join("");
            } else {
                result = ["[<span class='ts-reg'>", arg.regName, "</span> - <span class='ts-im'>", -arg.disp(), "</span>]"].join("");
            }
        } else if (type === me.instruction.ARG_IMM8 ||
                   type === me.instruction.ARG_IMM16 ||
                   type === me.instruction.ARG_IMM32) {
            result = ["<span class='ts-im'>", arg.src(), "</span>"].join("");
        } else if (type === me.instruction.ARG_LABEL) {
            result = ["<span class='ts-label'>", arg.src(), "</span>"].join("");
        } else if (type === me.instruction.ARG_STR) {
            result = ["<span class='ts-string'>", arg.src(), "</span>"].join("");
        } else if (type === me.instruction.ARG_ARR) {
            result = ["<span class='ts-im'>", arg.src(), "</span>"].join("");
        } else {
            result = "　";
        }

        return result;
    }


    function createStackTable($container, machine, conf) {
        if (conf.PANEL_VERTICAL) {
            $container.append($("<div></div>"));
        }

        var $fieldset = $("<fieldset><legend>スタック</legend></fieldset>").addClass("stack-section");
        var $div = $("<div></div>").addClass("stack-section-div");
        $fieldset.append($div);

        var $table = $("<table></table>");
        $div.append($table);
        $table.append("<tr>" +
                (conf.SHOW_STACK_ESP ? "<th>ESP</th>" : "") +
                (conf.SHOW_STACK_EBP ? "<th>EBP</th>" : "") +
                "<th>アドレス</th><th>データ</th><th>コメント</th></tr>");

        var st = conf.STACK_START;

        var $stackRows = {};

        for (var addr = st - conf.DISPLAY_STACK_BYTES; addr <= st; addr += 4) {
            var val = machine.memory.read32(addr);
            if (!val) {
                val = 0;
            }

            var rowArr = [];
            rowArr.push("<tr>");
            if (conf.SHOW_STACK_ESP) {
                rowArr.push("<td class='stack-esp'>");
                rowArr.push(addr === st ? "=>" : "");
                rowArr.push("</td>");
            }
            if (conf.SHOW_STACK_EBP) {
                rowArr.push("<td class='stack-ebp'>");
                rowArr.push("");
                rowArr.push("</td>");
            }
            rowArr.push("<td>");
            rowArr.push(num2hex(addr, 2));
            rowArr.push("</td><td class='stack-data'>");
            rowArr.push(num2hex(val, 4));
            rowArr.push("</td><td class='stack-comment'>");
            rowArr.push("");
            rowArr.push("</td></tr>");

            var $row = $(rowArr.join(""));
            $table.append($row);

            $stackRows[addr] = $row;
        }

        $container.append($fieldset);


        addRegListenerStack(machine, $stackRows);
        addOnChangeListenerStack(machine, $stackRows);
        addOnResetListenerStack(machine, $stackRows);
    }


    function addRegListenerStack(machine, $stackRows) {
        STACK_REGS.forEach(function (reg) {
            machine.regs.addListener(reg, function (val, oldVal) {
                var $row = $stackRows[oldVal];

                if ($row) {
                    $row.find(".stack-" + reg).text("");
                }

                $row = $stackRows[val];

                if ($row) {
                    $row.find(".stack-" + reg).text("=>");
                }
            });
        });
    }


    function addOnChangeListenerStack(machine, $stackRows) {
        machine.memory.addOnChangeListener(function (addr, val) {
            var $row = $stackRows[addr];

            if ($row) {
                $row.find(".stack-data")
                    .text(num2hex(val, 4))
                    .addClass("changed-value");

                var attr = machine.memory.getAttribute(addr);

                if (attr) {
                    if (attr.funcId !== undefined) {
                        $row.addClass("function-" + attr.funcId);
                    }

                    if (attr.comment) {
                        $row.find(".stack-comment").text(attr.comment);
                    }
                }
            }
        });

        machine.addOnClockListener(function () {
            for (var addr in $stackRows) {
                var $row = $stackRows[addr];
                $row.find(".stack-data")
                    .removeClass("changed-value");
            }
        });
    }


    function addOnResetListenerStack(machine, $stackRows) {
        machine.addOnResetListener(function () {
            for (var addr in $stackRows) {
                var $row = $stackRows[addr];
                $row.removeClass(removeFunctionClass);
                $row.find(".stack-data")
                    .text(num2hex(0, 4))
                    .removeClass("changed-value");
                $row.find(".stack-comment").text("");
            }
        });
    }


    function removeFunctionClass(i, css) {
        var m = css.match(/(^|\s)function-\S+/g) || [];

        return m.join(" ");
    }


    function num2hex(num, numBytes) {
        var s = num.toString(16).toUpperCase();

        var len = numBytes * 2;

        if (s.length < len) {
            var zeros = [];

            for (var i = 0; i < len - s.length; i++) {
                zeros.push("0");
            }

            zeros.push(s);
            s = zeros.join("");
        }

        return s;
    }


    function bytes2str(bytes) {
        if (!bytes || bytes.length === 0) {
            return "";
        }

        var s = [];

        for (var i = 0; i < bytes.length; i++) {
            var d = bytes[i];

            if (d <= 0x0F) {
                s.push("0" + d.toString(16));
            } else {
                s.push(d.toString(16));
            }

            if (i % 5 === 4) {
                s.push("<br/>");
            }

            if (i === 8) {
                s.push("…");
                break;
            }
        }

        return s.join(" ").toUpperCase();
    }
})();
