// icons.js — Boxicons SVG inline จาก Iconify API (https://icon-sets.iconify.design/)
// icon(name, size) → SVG element · iconHtml(name, size) → HTML string

const ICO = {
  // ---- bx: (regular/outline) ----
  'align-left':   '<path fill="currentColor" d="M4 19h16v2H4zm0-4h11v2H4zm0-4h16v2H4zm0-8h16v2H4zm0 4h11v2H4z"/>',
  'align-center': '<path fill="currentColor" d="M4 19h16v2H4zm3-4h10v2H7zm-3-4h16v2H4zm0-8h16v2H4zm3 4h10v2H7z"/>',
  'align-right':  '<path fill="currentColor" d="M4 19h16v2H4zm5-4h11v2H9zm-5-4h16v2H4zm0-8h16v2H4zm5 4h11v2H9z"/>',
  'align-justify':'<path fill="currentColor" d="M4 7h16v2H4zm0-4h16v2H4zm0 8h16v2H4zm0 4h16v2H4zm2 4h12v2H6z"/>',
  'bold':         '<path fill="currentColor" d="M17.061 11.22A4.46 4.46 0 0 0 18 8.5C18 6.019 15.981 4 13.5 4H6v15h8c2.481 0 4.5-2.019 4.5-4.5a4.48 4.48 0 0 0-1.439-3.28M13.5 7c.827 0 1.5.673 1.5 1.5s-.673 1.5-1.5 1.5H9V7zm.5 9H9v-3h5c.827 0 1.5.673 1.5 1.5S14.827 16 14 16"/>',
  'italic':       '<path fill="currentColor" d="M19 7V4H9v3h2.868L9.012 17H5v3h10v-3h-2.868l2.856-10H19z"/>',
  'underline':    '<path fill="currentColor" d="M5 18h14v2H5zM6 4v6c0 3.309 2.691 6 6 6s6-2.691 6-6V4h-2v6c0 2.206-1.794 4-4 4s-4-1.794-4-4V4z"/>',
  'strikethrough':'<path fill="currentColor" d="M20 11h-8c-4 0-4-1.816-4-2.5C8 7.882 8 6 12 6c2.8 0 2.99 1.678 3 2.014L16 8h1c0-1.384-1.045-4-5-4c-5.416 0-6 3.147-6 4.5c0 .728.148 1.667.736 2.5H4v2h16zm-8 7c-3.793 0-3.99-1.815-4-2H6c0 .04.069 4 6 4c5.221 0 6-2.819 6-4.5c0-.146-.009-.317-.028-.5h-2.006c.032.2.034.376.034.5c0 .684 0 2.5-4 2.5"/>',
  // [alpha.97 ข้อ 4] ตัวยก/ตัวห้อย — X ตัวใหญ่ + เลข 2 ที่มุมบน/มุมล่าง
  'superscript':  '<path fill="currentColor" d="M4 19h2.5l3.1-4.9h.1l3.1 4.9H16l-4.3-6.6L15.7 6h-2.4l-2.8 4.5h-.1L7.6 6H5.1l4 6.4zm14-9h5V8.7h-2.8c1.7-1.3 2.7-2.1 2.7-3.3c0-1.1-.9-1.9-2.2-1.9c-1.2 0-2.2.7-2.4 1.9l1.3.3c.1-.6.5-.9 1-.9s.9.3.9.8c0 .7-.8 1.3-3.5 3.4z"/>',
  'subscript':    '<path fill="currentColor" d="M4 18h2.5l3.1-4.9h.1l3.1 4.9H16l-4.3-6.6L15.7 5h-2.4l-2.8 4.5h-.1L7.6 5H5.1l4 6.4zm14 2h5v-1.3h-2.8c1.7-1.3 2.7-2.1 2.7-3.3c0-1.1-.9-1.9-2.2-1.9c-1.2 0-2.2.7-2.4 1.9l1.3.3c.1-.6.5-.9 1-.9s.9.3.9.8c0 .7-.8 1.3-3.5 3.4z"/>',
  'list-ul':      '<path fill="currentColor" d="M4 6h2v2H4zm0 5h2v2H4zm0 5h2v2H4zm16-8V6H8.023v2H18.8zM8 11h12v2H8zm0 5h12v2H8z"/>',
  'list-ol':      '<path fill="currentColor" d="M5.282 12.064c-.428.328-.72.609-.875.851q-.233.361-.279.768h2.679v-.748H5.413c.081-.081.152-.151.212-.201q.093-.076.361-.27q.454-.327.626-.604c.116-.186.173-.375.173-.578a.9.9 0 0 0-.151-.512.9.9 0 0 0-.412-.341q-.262-.113-.733-.111q-.451 0-.706.114a.9.9 0 0 0-.396.338q-.141.216-.194.604l.894.076q.037-.28.147-.394a.38.38 0 0 1 .279-.108q.165 0 .272.108a.34.34 0 0 1 .108.258a.55.55 0 0 1-.108.297q-.11.154-.503.453m.055 6.386a.4.4 0 0 1-.282-.105q-.111-.104-.162-.378L4 18.085q.088.306.251.506t.417.306Q4.92 19 5.36 19q.45 0 .725-.14a1 1 0 0 0 .424-.403q.146-.26.146-.544a.8.8 0 0 0-.088-.393.7.7 0 0 0-.249-.261a1 1 0 0 0-.286-.11a.94.94 0 0 0 .345-.299a.67.67 0 0 0 .113-.383a.75.75 0 0 0-.281-.596q-.28-.238-.909-.238q-.548 0-.847.219q-.3.216-.404.626l.844.151q.034-.242.133-.338c.099-.096.151-.098.257-.098a.33.33 0 0 1 .241.089q.088.09.087.238q0 .155-.117.27c-.117.115-.177.112-.293.112a1 1 0 0 1-.116-.011l-.045.649a1 1 0 0 1 .289-.056q.199 0 .313.126q.115.123.115.352q0 .22-.119.354a.4.4 0 0 1-.301.134m.948-10.083V5h-.739a1.5 1.5 0 0 1-.394.523q-.252.212-.708.365v.754a2.6 2.6 0 0 0 .937-.48v2.206zM9 6h11v2H9zm0 5h11v2H9zm0 5h11v2H9z"/>',
  'code-alt':     '<path fill="currentColor" d="m7.375 16.781l1.25-1.562L4.601 12l4.024-3.219l-1.25-1.562l-5 4a1 1 0 0 0 0 1.562zm9.25-9.562l-1.25 1.562L19.399 12l-4.024 3.219l1.25 1.562l5-4a1 1 0 0 0 0-1.562zm-1.649-4.003l-4 18l-1.953-.434l4-18z"/>',
  'bot':          '<path fill="currentColor" d="M21.928 11.607c-.202-.488-.635-.605-.928-.633V8c0-1.103-.897-2-2-2h-6V4.61c.305-.274.5-.668.5-1.11a1.5 1.5 0 0 0-3 0c0 .442.195.836.5 1.11V6H5c-1.103 0-2 .897-2 2v2.997l-.082.006A1 1 0 0 0 1.99 12v2a1 1 0 0 0 1 1H3v5c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2v-5a1 1 0 0 0 1-1v-1.938a1 1 0 0 0-.072-.455M5 20V8h14l.001 3.996L19 12v2l.001.005l.001 5.995z"/><ellipse cx="8.5" cy="12" fill="currentColor" rx="1.5" ry="2"/><ellipse cx="15.5" cy="12" fill="currentColor" rx="1.5" ry="2"/><path fill="currentColor" d="M8 16h8v2H8z"/>',
  'chevron-right':'<path fill="currentColor" d="M10.707 17.707L16.414 12l-5.707-5.707l-1.414 1.414L13.586 12l-4.293 4.293z"/>',
  'expand':       '<path fill="currentColor" d="m21 15.344l-2.121 2.121l-3.172-3.172l-1.414 1.414l3.172 3.172L15.344 21H21zM3 8.656l2.121-2.121l3.172 3.172l1.414-1.414l-3.172-3.172L8.656 3H3zM21 3h-5.656l2.121 2.121l-3.172 3.172l1.414 1.414l3.172-3.172L21 8.656zM3 21h5.656l-2.121-2.121l3.172-3.172l-1.414-1.414l-3.172 3.172L3 15.344z"/>',
  'fullscreen':   '<path fill="currentColor" d="M5 5h5V3H3v7h2zm5 14H5v-5H3v7h7zm11-5h-2v5h-5v2h7zm-2-4h2V3h-7v2h5z"/>',
  'history':      '<path fill="currentColor" d="M12 8v5h5v-2h-3V8z"/><path fill="currentColor" d="M21.292 8.497a9 9 0 0 0-1.928-2.862a9 9 0 0 0-4.55-2.452a9.1 9.1 0 0 0-3.626 0a8.97 8.97 0 0 0-4.552 2.453a9 9 0 0 0-1.928 2.86A9 9 0 0 0 4 12l.001.025H2L5 16l3-3.975H6.001L6 12a6.96 6.96 0 0 1 1.195-3.913a7 7 0 0 1 1.891-1.892a7 7 0 0 1 2.503-1.054a7.003 7.003 0 0 1 8.269 5.445a7.1 7.1 0 0 1 0 2.824a6.9 6.9 0 0 1-1.054 2.503c-.25.371-.537.72-.854 1.036a7.1 7.1 0 0 1-2.225 1.501a7 7 0 0 1-1.313.408a7.1 7.1 0 0 1-2.823 0a7 7 0 0 1-2.501-1.053a7.1 7.1 0 0 1-1.037-.855l-1.414 1.414A9 9 0 0 0 13 21a9.1 9.1 0 0 0 3.503-.707a9 9 0 0 0 3.959-3.26A8.97 8.97 0 0 0 22 12a8.9 8.9 0 0 0-.708-3.503"/>',
  'link':         '<path fill="currentColor" d="M8.465 11.293c1.133-1.133 3.109-1.133 4.242 0l.707.707l1.414-1.414l-.707-.707c-.943-.944-2.199-1.465-3.535-1.465s-2.592.521-3.535 1.465L4.929 12a5.01 5.01 0 0 0 0 7.071a4.98 4.98 0 0 0 3.535 1.462A4.98 4.98 0 0 0 12 19.071l.707-.707l-1.414-1.414l-.707.707a3.007 3.007 0 0 1-4.243 0a3.005 3.005 0 0 1 0-4.243z"/><path fill="currentColor" d="m12 4.929l-.707.707l1.414 1.414l.707-.707a3.007 3.007 0 0 1 4.243 0a3.005 3.005 0 0 1 0 4.243l-2.122 2.121c-1.133 1.133-3.109 1.133-4.242 0L10.586 12l-1.414 1.414l.707.707c.943.944 2.199 1.465 3.535 1.465s2.592-.521 3.535-1.465L19.071 12a5.01 5.01 0 0 0 0-7.071a5.006 5.006 0 0 0-7.071 0"/>',
  // ---- bxs: (solid/filled) ----
  'save':         '<path fill="currentColor" d="M5 21h14a2 2 0 0 0 2-2V8l-5-5H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2M7 5h4v2h2V5h2v4H7zm0 8h10v6H7z"/>',
  'file':         '<path fill="currentColor" d="M18 22a2 2 0 0 0 2-2V8l-6-6H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2zM13 4l5 5h-5zM7 8h3v2H7zm0 4h10v2H7zm0 4h10v2H7z"/>',
  'book':         '<path fill="currentColor" d="M6.012 18H21V4a2 2 0 0 0-2-2H6c-1.206 0-3 .799-3 3v14c0 2.201 1.794 3 3 3h15v-2H6.012C5.55 19.988 5 19.805 5 19s.55-.988 1.012-1M8 6h9v2H8z"/>',
  'book-open':    '<path fill="currentColor" d="M21 3h-7a2.98 2.98 0 0 0-2 .78A2.98 2.98 0 0 0 10 3H3a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h5.758a2 2 0 0 1 1.414.586l1.121 1.121c.009.009.021.012.03.021c.086.08.182.15.294.196h.002a1 1 0 0 0 .762 0h.002c.112-.046.208-.117.294-.196c.009-.009.021-.012.03-.021l1.121-1.121A2 2 0 0 1 15.242 20H21a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1m-1 15h-4.758a4.03 4.03 0 0 0-2.242.689V6c0-.551.448-1 1-1h6z"/>',
  'note':         '<path fill="currentColor" d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8l8-8V5a2 2 0 0 0-2-2m-7 16v-7h7z"/>',
  'layout':       '<path fill="currentColor" d="M19 3H5c-1.103 0-2 .897-2 2v4h18V5c0-1.103-.897-2-2-2M3 19c0 1.103.897 2 2 2h8V11H3zm12 2h4c1.103 0 2-.897 2-2v-8h-6z"/>',
  'dock-right':   '<path fill="currentColor" d="M21 5c0-1.103-.897-2-2-2H5c-1.103 0-2 .897-2 2v14c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2zM5 5h9v14H5z"/>',
  'grid':         '<path fill="currentColor" d="M4 4h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 10h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 16h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z"/>',
  'chat':         '<path fill="currentColor" d="M12 2C6.486 2 2 5.589 2 10c0 2.908 1.897 5.516 5 6.934V22l5.34-4.004C17.697 17.852 22 14.32 22 10c0-4.411-4.486-8-10-8m-2.5 9a1.5 1.5 0 1 1 0-3a1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3a1.5 1.5 0 0 1 0 3"/>', // bxs:message-rounded-dots
  'home':         '<path fill="currentColor" d="M12.74 2.32a1 1 0 0 0-1.48 0l-9 10A1 1 0 0 0 3 14h2v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7h2a1 1 0 0 0 1-1a1 1 0 0 0-.26-.68z"/>',
  'minus':        '<path fill="currentColor" d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10s10-4.486 10-10S17.514 2 12 2m5 11H7v-2h10z"/>', // bxs:minus-circle
  'plus':         '<path fill="currentColor" d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10s10-4.486 10-10S17.514 2 12 2m5 11h-4v4h-2v-4H7v-2h4V7h2v4h4z"/>', // bxs:plus-circle
  'reset':        '<path fill="currentColor" d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10s10-4.486 10-10S17.514 2 12 2m4.207 12.793l-1.414 1.414L12 13.414l-2.793 2.793l-1.414-1.414L10.586 12L7.793 9.207l1.414-1.414L12 10.586l2.793-2.793l1.414 1.414L13.414 12z"/>', // bxs:x-circle
  'x':            '<path fill="currentColor" d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10s10-4.486 10-10S17.514 2 12 2m4.207 12.793l-1.414 1.414L12 13.414l-2.793 2.793l-1.414-1.414L10.586 12L7.793 9.207l1.414-1.414L12 10.586l2.793-2.793l1.414 1.414L13.414 12z"/>', // same as reset (x-circle)
  'image':        '<path fill="currentColor" d="M5 21h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2m3-7l2.363 2.363L14 11l5 7H5z"/>', // bxs:image-alt
  'image-add':    '<path fill="currentColor" d="m9 13l3-4l3 4.5V12h4V5c0-1.103-.897-2-2-2H4c-1.103 0-2 .897-2 2v12c0 1.103.897 2 2 2h8v-4H5l3-4z"/><path fill="currentColor" d="M19 14h-2v3h-3v2h3v3h2v-3h3v-2h-3z"/>',
  'archive':      '<path fill="currentColor" d="m21.706 5.292l-2.999-2.999A1 1 0 0 0 18 2H6a1 1 0 0 0-.707.293L2.294 5.292A1 1 0 0 0 2 6v13c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V6a1 1 0 0 0-.294-.708M6.414 4h11.172l1 1H5.414zM12 18l-5-5h3v-3h4v3h3z"/>', // bxs:archive-in
  'book-content': '<path fill="currentColor" d="M19 2H6c-1.206 0-3 .799-3 3v14c0 2.201 1.794 3 3 3h15v-2H6.012C5.55 19.988 5 19.806 5 19q0-.15.024-.273c.112-.576.584-.717.988-.727H21V4a2 2 0 0 0-2-2m0 9l-2-1l-2 1V4h4z"/>', // bxs:book-bookmark
  'folder':       '<path fill="currentColor" d="M20 5h-9.586L8.707 3.293A1 1 0 0 0 8 3H4c-1.103 0-2 .897-2 2v14c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V7c0-1.103-.897-2-2-2"/>',
  'user':         '<path fill="currentColor" d="M7.5 6.5C7.5 8.981 9.519 11 12 11s4.5-2.019 4.5-4.5S14.481 2 12 2S7.5 4.019 7.5 6.5M20 21h1v-1c0-3.859-3.141-7-7-7h-4c-3.86 0-7 3.141-7 7v1z"/>',
  'map':          '<path fill="currentColor" d="M12 2C7.589 2 4 5.589 4 9.995C3.971 16.44 11.696 21.784 12 22c0 0 8.029-5.56 8-12c0-4.411-3.589-8-8-8m0 12c-2.21 0-4-1.79-4-4s1.79-4 4-4s4 1.79 4 4s-1.79 4-4 4"/>',
  'briefcase':    '<path fill="currentColor" d="M20 6h-3V4c0-1.103-.897-2-2-2H9c-1.103 0-2 .897-2 2v2H4c-1.103 0-2 .897-2 2v4h5v-2h2v2h6v-2h2v2h5V8c0-1.103-.897-2-2-2M9 4h6v2H9zm8 11h-2v-2H9v2H7v-2H2v6c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2v-6h-5z"/>',
  'bookmark':     '<path fill="currentColor" d="M19 10.132v-6c0-1.103-.897-2-2-2H7c-1.103 0-2 .897-2 2V22l7-4.666L19 22z"/>',
  'clipboard':    '<path fill="currentColor" d="M19 4h-3V2h-2v2h-4V2H8v2H5c-1.103 0-2 .897-2 2v14c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2V6c0-1.103-.897-2-2-2m-7 10H7v-2h5zm5-4H7V8h10z"/>', // bxs:notepad
  'camera':       '<path fill="currentColor" d="M12 9c-1.626 0-3 1.374-3 3s1.374 3 3 3s3-1.374 3-3s-1.374-3-3-3"/><path fill="currentColor" d="M20 5h-2.586l-2.707-2.707A1 1 0 0 0 14 2h-4a1 1 0 0 0-.707.293L6.586 5H4c-1.103 0-2 .897-2 2v11c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V7c0-1.103-.897-2-2-2m-8 12c-2.71 0-5-2.29-5-5s2.29-5 5-5s5 2.29 5 5s-2.29 5-5 5"/>',
  'cog':          '<path fill="currentColor" d="m2.344 15.271l2 3.46a1 1 0 0 0 1.366.365l1.396-.806c.58.457 1.221.832 1.895 1.112V21a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.598a8 8 0 0 0 1.895-1.112l1.396.806c.477.275 1.091.11 1.366-.365l2-3.46a1.004 1.004 0 0 0-.365-1.366l-1.372-.793a7.7 7.7 0 0 0-.002-2.224l1.372-.793c.476-.275.641-.89.365-1.366l-2-3.46a1 1 0 0 0-1.366-.365l-1.396.806A8 8 0 0 0 15 4.598V3a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v1.598A8 8 0 0 0 7.105 5.71L5.71 4.904a1 1 0 0 0-1.366.365l-2 3.46a1.004 1.004 0 0 0 .365 1.366l1.372.793a7.7 7.7 0 0 0 0 2.224l-1.372.793c-.476.275-.641.89-.365 1.366M12 8c2.206 0 4 1.794 4 4s-1.794 4-4 4s-4-1.794-4-4s1.794-4 4-4"/>',
  'brain':        '<path fill="currentColor" d="M3.299 17.596c.432 1.332 1.745 2.182 3.146 2.182H6.5A2.78 2.78 0 0 0 9.223 22c.457 0 .884-.115 1.262-.313a.99.99 0 0 0 .515-.882V3.027a1 1 0 0 0-.785-.983a2.32 2.32 0 0 0-1.479.201c-.744.356-1.18 1.151-1.18 1.978v.055a2.778 2.778 0 0 0-2.744 4.433A3.33 3.33 0 0 0 2 12c0 1.178.611 2.211 1.533 2.812c-.43.771-.571 1.746-.234 2.784m15.889-8.885a2.778 2.778 0 0 0-2.744-4.433v-.055c0-.826-.437-1.622-1.181-1.978a2.32 2.32 0 0 0-1.478-.201a1 1 0 0 0-.785.983v17.777c0 .365.192.712.516.882c.378.199.804.314 1.261.314a2.78 2.78 0 0 0 2.723-2.223h.056c1.4 0 2.714-.85 3.146-2.182c.337-1.038.196-2.013-.234-2.784A3.35 3.35 0 0 0 22 12a3.33 3.33 0 0 0-2.812-3.289"/>',
  // [alpha.60r2 ข้อ 10] ธีมสว่าง/มืด — ปุ่ม #tb-theme
  'sun':          '<path fill="currentColor" d="M6.995 12c0 2.761 2.246 5.007 5.007 5.007s5.007-2.246 5.007-5.007s-2.246-5.007-5.007-5.007S6.995 9.239 6.995 12M11 19h2v3h-2zm0-17h2v3h-2zm-9 9h3v2H2zm17 0h3v2h-3zM5.637 19.778l-1.414-1.414l2.121-2.121l1.414 1.414zM16.242 6.344l2.122-2.122l1.414 1.414l-2.122 2.122zM6.344 7.759L4.223 5.637l1.415-1.414l2.12 2.122zm13.434 10.605l-1.414 1.414l-2.122-2.122l1.414-1.414z"/>',
  'star':         '<path fill="currentColor" d="M21.947 9.179a1 1 0 0 0-.868-.676l-5.701-.453l-2.467-5.461a.998.998 0 0 0-1.822-.001L8.622 8.05l-5.701.453a1 1 0 0 0-.619 1.713l4.213 4.107l-1.49 6.452a1 1 0 0 0 1.53 1.057L12 18.202l5.445 3.63a1.001 1.001 0 0 0 1.517-1.106l-1.829-6.4l4.536-4.082c.297-.268.406-.686.278-1.065"/>',
  'error':        '<path fill="currentColor" d="M12.884 2.532c-.346-.654-1.422-.654-1.768 0l-9 17A1 1 0 0 0 3 21h18a.998.998 0 0 0 .883-1.467zM13 18h-2v-2h2zm-2-4V9h2l.001 5z"/>', // bxs:error (alert-triangle)
  'check':        '<path fill="currentColor" d="M11.488 21.754c.294.157.663.156.957-.001c8.012-4.304 8.581-12.713 8.574-15.104a.99.99 0 0 0-.596-.903l-8.05-3.566a1 1 0 0 0-.813.001L3.566 5.747a.99.99 0 0 0-.592.892c-.034 2.379.445 10.806 8.514 15.115M8.674 10.293l2.293 2.293l4.293-4.293l1.414 1.414l-5.707 5.707l-3.707-3.707z"/>', // bxs:check-shield
  'edit':         '<path fill="currentColor" d="m18.988 2.012l3 3L19.701 7.3l-3-3zM8 16h3l7.287-7.287l-3-3L8 13z"/><path fill="currentColor" d="M19 19H8.158c-.026 0-.053.01-.079.01c-.033 0-.066-.009-.1-.01H5V5h6.847l2-2H5c-1.103 0-2 .896-2 2v14c0 1.104.897 2 2 2h14a2 2 0 0 0 2-2v-8.668l-2 2z"/>',
  'trash':        '<path fill="currentColor" d="M6 7H5v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7zm4 12H8v-9h2zm6 0h-2v-9h2zm.618-15L15 2H9L7.382 4H3v2h18V4z"/>',
  'chevron-down': '<path fill="currentColor" d="M16.939 7.939L12 12.879l-4.939-4.94l-2.122 2.122L12 17.121l7.061-7.06z"/>',
  'quote-left':   '<path fill="currentColor" d="M20.309 17.708C22.196 15.66 22.006 13.03 22 13V5a1 1 0 0 0-1-1h-6c-1.103 0-2 .897-2 2v7a1 1 0 0 0 1 1h3.078a2.9 2.9 0 0 1-.429 1.396c-.508.801-1.465 1.348-2.846 1.624l-.803.16V20h1c2.783 0 4.906-.771 6.309-2.292m-11.007 0C11.19 15.66 10.999 13.03 10.993 13V5a1 1 0 0 0-1-1h-6c-1.103 0-2 .897-2 2v7a1 1 0 0 0 1 1h3.078a2.9 2.9 0 0 1-.429 1.396c-.508.801-1.465 1.348-2.846 1.624l-.803.16V20h1c2.783 0 4.906-.771 6.309-2.292"/>', // bxs:quote-right
  'film':         '<path fill="currentColor" d="M19 4v1h-2V3H7v2H5V3H3v18h2v-2h2v2h10v-2h2v2h2V3h-2zM5 7h2v2H5zm0 4h2v2H5zm0 6v-2h2v2zm12 0v-2h2v2zm2-4h-2v-2h2zm-2-4V7h2v2z"/>',
  'search':       '<path fill="currentColor" d="M10 2c-4.411 0-8 3.589-8 8s3.589 8 8 8a7.95 7.95 0 0 0 4.897-1.688l4.396 4.396l1.414-1.414l-4.396-4.396A7.95 7.95 0 0 0 18 10c0-4.411-3.589-8-8-8"/>',
  'cloud-lightning':'<path fill="currentColor" d="M18.944 10.112C18.507 6.67 15.56 4 12 4C9.244 4 6.85 5.611 5.757 8.15C3.609 8.792 2 10.82 2 13c0 2.757 2.243 5 5 5h1.333L10 13h4l-2 3h2.975l-1.325 2H18c2.206 0 4-1.794 4-4a4.01 4.01 0 0 0-3.056-3.888M11 18H8.333L8 19h3v3l2.649-4H11.5z"/>',
  // ---- alternatives (ไม่มีใน Boxicons) ----
  'extension':    '<path fill="currentColor" d="M19 10V7c0-1.103-.897-2-2-2h-3c0-1.654-1.346-3-3-3S8 3.346 8 5H5c-1.103 0-2 .897-2 2v4h1a2 2 0 0 1 0 4H3v4c0 1.103.897 2 2 2h4v-1a2 2 0 0 1 4 0v1h4c1.103 0 2-.897 2-2v-3c1.654 0 3-1.346 3-3s-1.346-3-3-3"/>', // bxs:extension ใช้แทน puzzle
  'maximize':     '<path fill="currentColor" d="M5 5h5V3H3v7h2zm5 14H5v-5H3v7h7zm11-5h-2v5h-5v2h7zm-2-4h2V3h-7v2h5z"/>', // bx:fullscreen ใช้แทน maximize เต็มจอ
  // [alpha.60r ข้อ 4] ไอคอนแดชบอร์ด
  'chart':        '<path fill="currentColor" d="M19 3H5c-1.103 0-2 .897-2 2v14c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2M9 17H7v-7h2zm4 0h-2V7h2zm4 0h-2v-4h2z"/>', // bxs:bar-chart-square
  // [alpha.60r3 ข้อ 6] ซ่อน/แสดงรหัสนำหน้าบรรทัด (bx:show / bx:hide)
  'eye':          '<path fill="currentColor" d="M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6"/><path fill="currentColor" d="M12 5c-7.633 0-9.927 6.617-9.948 6.684L1.946 12l.105.316C2.073 12.383 4.367 19 12 19s9.927-6.617 9.948-6.684l.106-.316l-.105-.316C21.927 11.617 19.633 5 12 5m0 12c-5.351 0-7.424-3.846-7.926-5C4.578 10.842 6.652 7 12 7c5.351 0 7.424 3.846 7.926 5c-.504 1.158-2.578 5-7.926 5"/>',
  'eye-off':      '<path fill="currentColor" d="M12 19c.946 0 1.81-.103 2.598-.281l-1.757-1.757c-.273.021-.55.038-.841.038c-5.351 0-7.424-3.846-7.926-5a8.6 8.6 0 0 1 1.508-2.297L4.184 8.305C1.923 10.427 1.026 12.607 1.002 12.673l-.181.499l.181.499C1.031 13.746 3.845 19 12 19m0-14c-1.837 0-3.346.396-4.605.981L3.707 2.293L2.293 3.707l18 18l1.414-1.414l-3.319-3.319c2.614-1.951 3.547-4.615 3.573-4.694l.181-.499l-.181-.499C21.969 10.254 19.155 5 12 5m4.972 10.558l-2.28-2.28c.19-.39.308-.819.308-1.278a2.99 2.99 0 0 0-3-3c-.459 0-.888.118-1.277.309L8.915 7.501A9.3 9.3 0 0 1 12 7c5.351 0 7.424 3.846 7.926 5c-.302.692-1.166 2.342-2.954 3.558"/>',
};

// มีไอคอนชื่อนี้จริงไหม — ใช้กรองค่าเก่าที่เก็บเป็นอีโมจิ (ไม่งั้นได้ svg ว่าง)
export function hasIcon(name) { return !!(name && ICO[name]); }

// [alpha.60r ข้อ 6] NerdFonts character mapping — ใช้เมื่อมีฟอนต์ NerdFont ติดตั้งในระบบ
// รหัส Unicode ของ NerdFonts v3: https://www.nerdfonts.com/cheat-sheet
const NF = {
  'bold':         '\uf032', // nf-fa-bold
  'italic':       '\uf033', // nf-fa-italic
  'underline':    '\uf0cd', // nf-fa-underline
  'strikethrough':'\uf0cc', // nf-fa-strikethrough
  'superscript':  '\uf12b', // nf-fa-superscript
  'subscript':    '\uf12c', // nf-fa-subscript
  'align-left':   '\uf036', // nf-fa-align_left
  'align-center': '\uf037', // nf-fa-align_center
  'align-right':  '\uf038', // nf-fa-align_right
  'align-justify':'\uf039', // nf-fa-align_justify
  'list-ul':      '\uf0ca', // nf-fa-list_ul
  'list-ol':      '\uf0cb', // nf-fa-list_ol
  'quote-left':   '\uf10d', // nf-fa-quote_left
  'code-alt':     '\uf121', // nf-fa-code
  'bot':          '\uebe1', // nf-md-robot
  'search':       '\uf002', // nf-fa-search
  'home':         '\uf015', // nf-fa-home
  'cog':          '\uf013', // nf-fa-cog
  'minus':        '\uf056', // nf-fa-minus_circle
  'plus':         '\uf055', // nf-fa-plus_circle
  'x':            '\uf057', // nf-fa-times_circle
  'reset':        '\uf057', // same as x
  'save':         '\uf0c7', // nf-fa-floppy_o
  'file':         '\uf016', // nf-fa-file_o
  'book':         '\uf02d', // nf-fa-book
  'book-open':    '\uf518', // nf-fa-book_open
  'note':         '\uf249', // nf-md-note
  'layout':       '\uf0db', // nf-fa-columns
  'dock-right':   '\uf0db', // same
  'grid':         '\uf00a', // nf-fa-th
  'chat':         '\uf086', // nf-fa-comments
  'image':        '\uf03e', // nf-fa-picture_o
  'image-add':    '\uf055', // plus
  'archive':      '\uf187', // nf-fa-archive
  'book-content': '\uf02d', // same
  'folder':       '\uf07b', // nf-fa-folder
  'user':         '\uf007', // nf-fa-user
  'map':          '\uf279', // nf-fa-map
  'briefcase':    '\uf0b1', // nf-fa-briefcase
  'bookmark':     '\uf02e', // nf-fa-bookmark
  'clipboard':    '\uf0f6', // nf-fa-clipboard
  'camera':       '\uf030', // nf-fa-camera
  'brain':        '\ueb61', // nf-md-brain
  'star':         '\uf005', // nf-fa-star
  'error':        '\uf071', // nf-fa-exclamation_triangle
  'check':        '\uf058', // nf-fa-check_circle
  'edit':         '\uf304', // nf-fa-pencil_square
  'trash':        '\uf1f8', // nf-fa-trash
  'chevron-down': '\uf078', // nf-fa-chevron_down
  'chevron-right':'\uf054', // nf-fa-chevron_right
  'film':         '\uf008', // nf-fa-film
  'expand':       '\uf065', // nf-fa-expand
  'fullscreen':   '\uf065', // same
  'history':      '\uf1da', // nf-fa-history
  'link':         '\uf0c1', // nf-fa-link
  'cloud-lightning':'\ue7ef', // nf-md-weather_lightning
  'extension':    '\uf12e', // nf-fa-puzzle_piece
  'maximize':     '\uf065', // same as expand
  'chart':        '\uf080', // nf-fa-bar_chart
  'eye':          '\uf06e', // nf-fa-eye
  'eye-off':      '\uf070', // nf-fa-eye_slash
};
// NerdFonts CSS — inject สร้าง @font-face ถ้าผู้ใช้มีฟอนต์
export function nfCss() {
  return `[data-nf]{font-family:'CaskaydiaCove NF','FiraCode Nerd Font','MesloLGS NF','JetBrainsMono NF',monospace;font-size:.95em;line-height:1}`;
}
export function hasNf(name) { return !!(name && NF[name]); }

// icon: SVG เป็นหลัก → fallback NerdFont ถ้า SVG ไม่มีข้อมูล
export function icon(name, size) {
  const sz = size || 18;
  const p = ICO[name] || '';
  // [alpha.60r ข้อ 6] fallback NerdFont ถ้า SVG ไม่มีข้อมูล
  if (!p && NF[name]) {
    const span = document.createElement('span');
    span.setAttribute('data-nf', '1');
    span.style.cssText = `vertical-align:middle;flex-shrink:0;pointer-events:none;font-size:${sz-2}px`;
    span.textContent = NF[name];
    return span;
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(sz));
  svg.setAttribute('height', String(sz));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'vertical-align:middle;flex-shrink:0;pointer-events:none';
  if (p) svg.innerHTML = p;
  return svg;
}

export function iconSvg(name, size) {
  const sz = size || 18;
  const p = ICO[name] || '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${p}</svg>`;
}

export function iconHtml(name, size) {
  const sz = size || 18;
  const p = ICO[name] || '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:middle;flex-shrink:0">${p}</svg>`;
}

export function initIcons(root) {
  const els = (root || document).querySelectorAll('[data-icon]');
  for (const el of els) {
    const name = el.getAttribute('data-icon');
    const sz = parseInt(el.getAttribute('data-icon-size'), 10) || 18;
    if (!name) continue;
    const svg = icon(name, sz);
    el.insertBefore(svg, el.firstChild);
    el.removeAttribute('data-icon');
    el.removeAttribute('data-icon-size');
  }
}

export function iconLabel(name, text, size) {
  const span = document.createElement('span');
  span.style.cssText = 'display:inline-flex;align-items:center;gap:4px';
  span.appendChild(icon(name, size || 16));
  if (text) span.appendChild(document.createTextNode(text));
  return span;
}
