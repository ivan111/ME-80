(function () {
    "use strict";

    me.link = link;


    function link(instructions, startAddr, ignoreLabelError) {
        var addr = startAddr;
        var labels = {};

        instructions.forEach(function (inst) {
            if (inst.op().toLowerCase() === "org") {
                addr = inst.arg0.value(null);
            } else {
                inst.addr(addr);
                addr += inst.bytes().length;
                var label = inst.label();

                if (label) {
                    if (labels[label]) {
                        inst.err("Label Name Conflict");
                    } else {
                        labels[label] = inst;
                    }
                }
            }
        });

        instructions.forEach(function (inst) {
            inst.args().forEach(function (arg) {
                if (arg.type === me.instruction.ARG_LABEL) {
                    var labelInst = labels[arg.label];

                    if (labelInst) {
                        arg.link(labelInst.addr());
                    } else if (!ignoreLabelError) {
                        inst.err("Not Found Label: " + arg.label);
                    }
                }
            });
        });


        return labels;
    }
})();
