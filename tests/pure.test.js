const assert = require("assert");
const {
    evaluateSearch,
    escapeHtml,
    getPriorityCategory,
    getAlertExpirationTime,
    getAlertIssuedTime,
    clampNumber,
    getValidLatLng,
    isExpired,
    cloneJson,
    formatDateTimeLocal,
    parseDateTimeLocal,
    formatWmsTime,
    getAlertIdHashInput,
    hashText,
    hashAlertId,
    stableStringify,
    getAlertMessageHash,
    getAlertDescriptionHash,
    getAlertReferenceHashes
} = require("../src/lib/pure");

function testEvaluateSearch(){
    const text = "tornado warning observed rotation springfield county";

    assert.strictEqual(evaluateSearch("", text), true);
    assert.strictEqual(evaluateSearch("tornado", text), true);
    assert.strictEqual(evaluateSearch("tornado & warning", text), true);
    assert.strictEqual(evaluateSearch("tornado & advisory", text), false);
    assert.strictEqual(evaluateSearch("advisory | warning", text), true);
    assert.strictEqual(evaluateSearch("tornado & !advisory", text), true);
    assert.strictEqual(evaluateSearch("( advisory | warning ) & springfield", text), true);
    assert.strictEqual(evaluateSearch("flash", text), false);
}

function testEscapeHtml(){
    assert.strictEqual(
        escapeHtml(`<alert id="x&y">'`),
        "&lt;alert id=&quot;x&amp;y&quot;&gt;&#39;"
    );
}

function testPriorityCategory(){
    assert.strictEqual(getPriorityCategory("Tornado Warning"), "tornado-warning");
    assert.strictEqual(getPriorityCategory("Severe Thunderstorm Warning"), "warning");
    assert.strictEqual(getPriorityCategory("Flood Watch"), "watch");
    assert.strictEqual(getPriorityCategory("Winter Weather Advisory"), "advisory");
    assert.strictEqual(getPriorityCategory("Special Weather Statement"), "statement");
    assert.strictEqual(getPriorityCategory("Marine Dense Fog"), "other");
    assert.strictEqual(getPriorityCategory(null), "other");
}

function testAlertTimes(){
    assert.strictEqual(
        getAlertExpirationTime({ expires:"2026-07-04T12:00:00Z" }),
        Date.parse("2026-07-04T12:00:00Z")
    );
    assert.strictEqual(
        getAlertExpirationTime({ ends:"2026-07-04T13:00:00Z" }),
        Date.parse("2026-07-04T13:00:00Z")
    );
    assert.strictEqual(getAlertExpirationTime({ expires:"not a date" }), null);

    assert.strictEqual(
        getAlertIssuedTime({ sent:"2026-07-04T10:00:00Z" }),
        Date.parse("2026-07-04T10:00:00Z")
    );
    assert.strictEqual(
        getAlertIssuedTime({ effective:"2026-07-04T10:30:00Z" }),
        Date.parse("2026-07-04T10:30:00Z")
    );
    assert.strictEqual(
        getAlertIssuedTime({ onset:"2026-07-04T11:00:00Z" }),
        Date.parse("2026-07-04T11:00:00Z")
    );
    assert.strictEqual(getAlertIssuedTime({ sent:"not a date" }), null);
}

function testClampNumber(){
    assert.strictEqual(clampNumber("5", 1, 10, 3), 5);
    assert.strictEqual(clampNumber("-2", 1, 10, 3), 1);
    assert.strictEqual(clampNumber("12", 1, 10, 3), 10);
    assert.strictEqual(clampNumber("abc", 1, 10, 3), 3);
}

function testCoordinates(){
    assert.deepStrictEqual(getValidLatLng("39.1", "-84.5"), [39.1, -84.5]);
    assert.strictEqual(getValidLatLng("91", "0"), null);
    assert.strictEqual(getValidLatLng("0", "-181"), null);
    assert.strictEqual(getValidLatLng("north", "0"), null);
}

function testExpirationAndClone(){
    assert.strictEqual(
        isExpired({ expires:"2026-07-04T12:00:00Z" }, Date.parse("2026-07-04T12:01:00Z")),
        true
    );
    assert.strictEqual(
        isExpired({ expires:"2026-07-04T12:00:00Z" }, Date.parse("2026-07-04T11:59:00Z")),
        false
    );
    assert.strictEqual(isExpired({ expires:"not a date" }, Date.now()), false);
    assert.strictEqual(isExpired({}, Date.now()), false);

    const value={ nested:{ count:1 } };
    const cloned=cloneJson(value);
    cloned.nested.count=2;
    assert.strictEqual(value.nested.count, 1);
}

function testDateFormatting(){
    assert.strictEqual(parseDateTimeLocal("2026-07-04T12:30"), new Date("2026-07-04T12:30").getTime());
    assert.strictEqual(Number.isNaN(parseDateTimeLocal("")), true);
    assert.strictEqual(formatWmsTime(Date.parse("2026-07-04T12:07:59Z")), "2026-07-04T12:05:00Z");

    const formatted=formatDateTimeLocal(Date.parse("2026-07-04T12:30:00Z"));
    assert.match(formatted, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
}

function testHashHelpers(){
    assert.strictEqual(getAlertIdHashInput("https://api.weather.gov/alerts/urn:oid:abc"), "urn:oid:abc");
    assert.strictEqual(getAlertIdHashInput("https%3A%2F%2Fapi.weather.gov%2Falerts%2Furn%3Aoid%3Aabc"), "urn:oid:abc");
    assert.strictEqual(hashText("abc"), "17862");
    assert.strictEqual(hashAlertId("https://api.weather.gov/alerts/urn:oid:abc"), hashText("urn:oid:abc"));
    assert.strictEqual(stableStringify({ b:2, a:1 }), '{"a":1,"b":2}');
    assert.strictEqual(getAlertMessageHash({ b:2, a:1 }), hashText('{"a":1,"b":2}'));
    assert.strictEqual(getAlertDescriptionHash({ description:"hello" }), hashText("hello"));
    assert.deepStrictEqual(
        getAlertReferenceHashes({
            references:[
                "urn:oid:first",
                { identifier:"urn:oid:second" },
                { "@id":"urn:oid:first" },
                { id:"" },
                null
            ]
        }),
        [hashText("urn:oid:first"), hashText("urn:oid:second")]
    );
}

testEvaluateSearch();
testEscapeHtml();
testPriorityCategory();
testAlertTimes();
testClampNumber();
testCoordinates();
testExpirationAndClone();
testDateFormatting();
testHashHelpers();

console.log("pure helper tests passed");
