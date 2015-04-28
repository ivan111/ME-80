(function() {
    "use strict";

    window.createIPL = createIPL;


    function createIPL($container, machine) {
        var $div = $("<div></div>").css("display", "inline-block").css("margin-top", "1em");

        createInt13Table($div, machine);
        createFD($div, machine);

        $container.append($div);
    }


    function createInt13Table($container, machine) {
        var $fieldset = $("<fieldset><legend>INT 0x13</legend></fieldset>");
        var $div = $("<div></div>");
        $fieldset.append($div);

        var $table = $("<table></table>");
        $div.append($table);
        $table.append("<tr><th>レジスタ</th><th>値</th><th>意味</th></tr>");
        $table.append("<tr><td>AH</td><td class='reg-ah'>00</td><td class='reg-ah-desc'></td></tr>");
        $table.append("<tr><td>AL</td><td class='reg-al'>00</td><td>処理するセクタ数</td></tr>");
        $table.append("<tr><td>CH</td><td class='reg-ch'>00</td><td>シリンダ番号 ＆ 0xFF</td></tr>");
        $table.append("<tr><td>CL</td><td class='reg-cl'>00</td><td>セクタ番号(bit0-5)</td></tr>");
        $table.append("<tr><td>DH</td><td class='reg-dh'>00</td><td>ヘッド番号</td></tr>");
        $table.append("<tr><td>DL</td><td class='reg-dl'>00</td><td>ドライブ番号</td></tr>");
        $table.append("<tr><td>ES:BX</td><td class='reg-es-bx'>0000:0000</td><td>バッファアドレス</td></tr>");

        $div.append("<p>CARRYフラグOFFの場合：<br/>　エラーなしでAHに0がセットされる。<br/><br />CARRYフラグONの場合：<br/>　エラーありでAHにエラーコードがセットされる。</p>");

        $container.append($fieldset);

        var $regAh = $table.find(".reg-ah");
        var $regAhDesc = $table.find(".reg-ah-desc");
        var $regAl = $table.find(".reg-al");

        machine.regs.addListener("ax", function (val) {
            var ah = (val & 0xFF00) >> 8;
            var ahs = num2hex(ah, 1);
            $regAh.text(ahs);

            if (ah === 0x02) {
                $regAhDesc.text("読み込み");
            } else if (ah === 0x03) {
                $regAhDesc.text("書き込み");
            } else if (ah === 0x04) {
                $regAhDesc.text("ベリファイ");
            } else if (ah === 0x0C) {
                $regAhDesc.text("シーク");
            } else {
                $regAhDesc.text("");
            }

            var al = val & 0xFF;
            var als = num2hex(al, 1);
            $regAl.text(als);
        });


        var $regCh = $table.find(".reg-ch");
        var $regCl = $table.find(".reg-cl");

        machine.regs.addListener("cx", function (val) {
            var ch = (val & 0xFF00) >> 8;
            var chs = num2hex(ch, 1);
            $regCh.text(chs);

            var cl = val & 0xFF;
            var cls = num2hex(cl, 1);
            $regCl.text(cls);
        });


        var $regDh = $table.find(".reg-dh");
        var $regDl = $table.find(".reg-dl");

        machine.regs.addListener("dx", function (val) {
            var dh = (val & 0xFF00) >> 8;
            var dhs = num2hex(dh, 1);
            $regDh.text(dhs);

            var dl = val & 0xFF;
            var dls = num2hex(dl, 1);
            $regDl.text(dls);
        });


        var $regEsBx = $table.find(".reg-es-bx");

        machine.regs.addListener("bx", function (val) {
            var es = machine.regs.es();
            var s = [num2hex(es, 2), num2hex(val, 2)].join(":");
            $regEsBx.text(s);
        });


        machine.regs.addListener("es", function (val) {
            var bx = machine.regs.bx();
            var s = [num2hex(val, 2), num2hex(bx, 2)].join(":");
            $regEsBx.text(s);
        });
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


    var PI2 = Math.PI * 2;
    var FD_CX = 100;
    var FD_CY = 100;
    var FD_R = 100;
    var ctxH;
    var ctxT;


    function createFD($container, machine) {
        var $fieldset = $("<fieldset><legend>FD</legend></fieldset>");
        var $div = $("<div></div>");
        $fieldset.append($div);

        var $divHead = $("<div></div>").addClass("stack-section-div");
        $divHead.append("<p>表</p>");
        var $head = $("<canvas width='200' height='200'></canvas>");
        $divHead.append($head);

        var $divTail = $("<div></div>").addClass("stack-section-div");
        $divTail.append("<p>裏</p>");
        var $tail = $("<canvas width='200' height='200'></canvas>");
        $divTail.append($tail);

        $div.append($divHead).append($divTail);

        ctxH = $head[0].getContext("2d");
        initFD(ctxH);

        ctxT = $tail[0].getContext("2d");
        initFD(ctxT);

        $container.append($fieldset);

        machine.addOnResetListener(function () {
            initFD(ctxH);
            initFD(ctxT);
        });

        machine.fd.addReadListener(readFD);
    }


    function initFD(ctx) {
        ctx.beginPath();
        ctx.arc(FD_CX, FD_CY, FD_R, 0, PI2, false);
        ctx.fillStyle = "#333";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "black";
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(FD_CX, FD_CY, 20, 0, PI2, false);
        ctx.fillStyle = "#CCC";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "black";
        ctx.stroke();
    }


    function readFD(h, c, s) {
        var ctx = ctxH;

        if (h === 1) {
            ctx = ctxT;
        }

        var r = FD_R - c;

        var st = PI2 * (s - 1) / 18;
        var ed = PI2 * s / 18;

        ctx.beginPath();
        ctx.arc(FD_CX, FD_CY, r, st, ed, false);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "red";
        ctx.stroke();
    }
})();
