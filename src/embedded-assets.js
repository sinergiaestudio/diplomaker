(function () {
  'use strict';
  const DM = window.Diplomaker = window.Diplomaker || {};
  const toDataUri = svg => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  DM.EmbeddedAssets = { backgrounds: {
    classic: toDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="792" viewBox="0 0 1120 792">
  <rect width="1120" height="792" fill="#fffdf8"/>
  <rect x="22" y="22" width="1076" height="748" rx="8" fill="none" stroke="#17365d" stroke-width="12"/>
  <rect x="43" y="43" width="1034" height="706" rx="4" fill="none" stroke="#c6a15b" stroke-width="3"/>
  <rect x="57" y="57" width="1006" height="678" rx="2" fill="none" stroke="#17365d" stroke-width="1" opacity=".6"/>
  <g fill="none" stroke="#c6a15b" stroke-width="4" opacity=".85">
    <path d="M75 146 C112 115 138 90 166 75"/><path d="M75 118 C101 101 116 89 132 75"/>
    <path d="M1045 146 C1008 115 982 90 954 75"/><path d="M1045 118 C1019 101 1004 89 988 75"/>
    <path d="M75 646 C112 677 138 702 166 717"/><path d="M75 674 C101 691 116 703 132 717"/>
    <path d="M1045 646 C1008 677 982 702 954 717"/><path d="M1045 674 C1019 691 1004 703 988 717"/>
  </g>
  <circle cx="560" cy="395" r="145" fill="none" stroke="#17365d" stroke-width="1" opacity=".035"/>
  <circle cx="560" cy="395" r="126" fill="none" stroke="#c6a15b" stroke-width="2" opacity=".045"/>
  <path d="M430 122 H690" stroke="#c6a15b" stroke-width="2"/>
  <circle cx="560" cy="122" r="5" fill="#c6a15b"/>
</svg>`),
    modern: toDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="792" viewBox="0 0 1120 792">
  <rect width="1120" height="792" fill="#ffffff"/>
  <path d="M0 0 H270 L150 120 H0 Z" fill="#8f2d3d"/>
  <path d="M0 0 H120 L0 120 Z" fill="#4d5056"/>
  <path d="M1120 792 H850 L970 672 H1120 Z" fill="#8f2d3d"/>
  <path d="M1120 792 H1000 L1120 672 Z" fill="#4d5056"/>
  <path d="M0 176 Q90 176 90 86 V246 Q0 246 0 336 Z" fill="#8f2d3d" opacity=".92"/>
  <path d="M1120 616 Q1030 616 1030 706 V546 Q1120 546 1120 456 Z" fill="#8f2d3d" opacity=".92"/>
  <circle cx="132" cy="166" r="26" fill="#8d8f93"/>
  <circle cx="988" cy="626" r="26" fill="#8d8f93"/>
  <g fill="#8f2d3d"><circle cx="96" cy="335" r="7"/><circle cx="96" cy="379" r="7"/><circle cx="96" cy="423" r="7"/><circle cx="96" cy="467" r="7"/><circle cx="96" cy="511" r="7"/></g>
  <g fill="#8f2d3d"><circle cx="1024" cy="281" r="7"/><circle cx="1024" cy="325" r="7"/><circle cx="1024" cy="369" r="7"/><circle cx="1024" cy="413" r="7"/><circle cx="1024" cy="457" r="7"/></g>
  <rect x="31" y="31" width="1058" height="730" fill="none" stroke="#d9d9dc" stroke-width="2"/>
</svg>`),
    academic: toDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="792" viewBox="0 0 1120 792">
  <rect width="1120" height="792" fill="#fbfaf4"/>
  <rect x="26" y="26" width="1068" height="740" rx="3" fill="none" stroke="#275d50" stroke-width="8"/>
  <rect x="43" y="43" width="1034" height="706" rx="2" fill="none" stroke="#c79a45" stroke-width="2"/>
  <path d="M420 94 H700" stroke="#275d50" stroke-width="3"/>
  <path d="M468 80 Q560 32 652 80" fill="none" stroke="#c79a45" stroke-width="3"/>
  <path d="M488 82 Q560 50 632 82" fill="none" stroke="#275d50" stroke-width="2"/>
  <g fill="none" stroke="#275d50" stroke-width="2" opacity=".55">
    <path d="M84 94 V190 M84 94 H180"/><path d="M1036 94 V190 M1036 94 H940"/>
    <path d="M84 698 V602 M84 698 H180"/><path d="M1036 698 V602 M1036 698 H940"/>
  </g>
  <g fill="#c79a45" opacity=".8"><circle cx="84" cy="94" r="5"/><circle cx="1036" cy="94" r="5"/><circle cx="84" cy="698" r="5"/><circle cx="1036" cy="698" r="5"/></g>
  <path d="M310 665 H810" stroke="#275d50" stroke-width="1" opacity=".25"/>
</svg>`)
  } };
})();
