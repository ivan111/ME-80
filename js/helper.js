(function () {
    "use strict";

    me.mergeDict = mergeDict;


    function mergeDict(dict1, dict2) {
        var result = {};

        if (!dict2) {
           dict2 = {};
        }

        for (var key in dict1) {
            result[key] = dict1[key];
        }

        for (key in dict2) {
            result[key] = dict2[key];
        }

        return result;
    }
}());
