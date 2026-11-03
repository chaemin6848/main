/* ---- 손으로 쓴 부분 (tools/i18n/jeildang-extra.js) ---- */
ND.terms();
// 영어 화면의 돈 표시: 억 단위는 백만·십억으로 바꾸고 통화 기호를 앞에 붙인다
ND.jdMoney = function (n, unit) {
  var cur = { "억 원": "₩", "억 엔": "¥", "백만 달러": "$", "백만 파운드": "£", "백만 유로": "€" }[unit] || "";
  var m = /^억/.test(unit) ? n * 100 : n, a = Math.abs(m), sign = m < 0 ? "−" : "";
  var r = function (x) { var d = x >= 100 ? 1 : x >= 10 ? 10 : 100; return Math.round(x * d) / d; };
  return a >= 1000 ? sign + cur + r(a / 1000) + "B" : sign + cur + r(a) + "M";
};
ND.pat("en", [
  [/^(.*?)([\d.]+)만 명$/, function (_, pre, n) { var k = parseFloat(n) * 10; pre = pre ? ND.t(pre.trim()) + " " : ""; return pre + (k >= 1000 ? Math.round(k / 100) / 10 + "M" : Math.round(k * 10) / 10 + "k"); }]
]);
// "연 수입 230억 엔"처럼 숫자 바로 뒤에 화폐 단위가 붙은 글
var MONEY_RE = /^(.*?)(−?[\d.]+)(억 원|억 엔|억|백만 달러|백만 파운드|백만 유로)$/;
ND.pat("en", [[MONEY_RE, function (_, pre, n, u) { return (pre ? ND.t(pre.trim()) + " " : "") + ND.jdMoney(parseFloat(n.replace("−", "-")), u); }]]);
ND.pat("ja", [[MONEY_RE, function (_, pre, n, u) { return (pre ? ND.t(pre.trim()) : "") + n + ND.t(u); }]]);
