// app.js
const socket = io();
const testimonialsEl = document.getElementById('testimonials');
// Example placeholders for testimonials - DO NOT use as real reviews unless authorized
const exampleTestimonials = [
  { name: 'Alex M.', text: 'Smooth and safe trade. Highly recommended (demo).', img: 'https://via.placeholder.com/72' },
  { name: 'S. Carter', text: 'Fast transfer, responsive support (demo).', img: 'https://via.placeholder.com/72' },
  { name: 'J. Lee', text: 'Trusted escrow, low fees (demo).', img: 'https://via.placeholder.com/72' },
  { name: 'M. Brown', text: 'Good experience overall (demo).', img: 'https://via.placeholder.com/72' },
  { name: 'Dana P.', text: 'Completed two trades without issue (demo).', img: 'https://via.placeholder.com/72' }
];
exampleTestimonials.forEach(t => {
  const d = document.createElement('div');
  d.className = 'testimonial';
  d.innerHTML = `<img src="${t.img}" alt="avatar"/><div><strong>${t.name}</strong></div><div class="small">${t.text}</div><div style="font-size:0.7rem;color:#888;margin-top:6px;">(example testimonial)</div>`;
  testimonialsEl.appendChild(d);
});

// Elements
const createOrderBtn = document.getElementById('createOrderBtn');
const loading = document.getElementById('loading');
const choice = document.getElementById('choice');
const buyBtn = document.getElementById('buyBtn');
const sellBtn = document.getElementById('sellBtn');
const orderInfo = document.getElementById('orderInfo');
const orderCodeEl = document.getElementById('orderCode');
const trcAddressEl = document.getElementById('trcAddress');
const goToChatBtn = document.getElementById('goToChatBtn');
const joinBox = document.getElementById('joinBox');
const joinCode = document.getElementById('joinCode');
const joinBtn = document.getElementById('joinBtn');
const nameInput = document.getElementById('nameInput');
const chatPanel = document.getElementById('chatPanel');
const chatWindow = document.getElementById('chatWindow');
const chatCodeEl = document.getElementById('chatCode');
const chatMsg = document.getElementById('chatMsg');
const sendMsg = document.getElementById('sendMsg');
const markPaid = document.getElementById('markPaid');
const requestRefund = document.getElementById('requestRefund');

let currentCode = null;

// Create order button -> show loading then choice
createOrderBtn.addEventListener('click', () => {
  choice.classList.remove('hidden');
  // Show 5s loading page first
  loading.classList.remove('hidden');
  setTimeout(()=> loading.classList.add('hidden'), 5000);
});

// buy / sell flows
function createOrder(type) {
  loading.classList.remove('hidden');
  fetch('/api/create-order', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ type, trc20_address: 'T-YOUR-TRC20-ADDRESS-HERE' })
  }).then(r=>r.json()).then(data => {
    loading.classList.add('hidden');
    currentCode = data.code;
    orderCodeEl.innerText = data.code;
    trcAddressEl.innerText = 'T-YOUR-TRC20-ADDRESS-HERE';
    orderInfo.classList.remove('hidden');
    choice.classList.add('hidden');
    // optionally generate a QR using a library or external service
  }).catch(err => {
    loading.classList.add('hidden');
    alert('Error creating order');
  });
}
buyBtn.addEventListener('click', ()=> createOrder('buy'));
sellBtn.addEventListener('click', ()=> createOrder('sell'));

// Go to join chat panel
goToChatBtn.addEventListener('click', () => {
  joinBox.classList.remove('hidden');
});

// Join by code
joinBtn.addEventListener('click', () => {
  const code = (joinCode.value||'').trim().toUpperCase();
  if(!code) return alert('Enter code');
  // Show chat panel and join socket room
  chatPanel.classList.remove('hidden');
  joinBox.classList.add('hidden');
  chatCodeEl.innerText = code;
  socket.emit('join', { code, name: nameInput.value || 'User' });
  currentCode = code;
});

// Socket events
socket.on('joined', d => {
  appendSystem(`Joined room ${d.code}`);
});
socket.on('system', d => appendSystem(d.message));
socket.on('msg', m => {
  appendMessage(m.from, m.text);
});
socket.on('order-updated', info => {
  appendSystem(`Order ${info.code} changed status: ${info.status}`);
});

// Send chat message
sendMsg.addEventListener('click', () => {
  const txt = chatMsg.value.trim();
  if(!txt || !currentCode) return;
  socket.emit('msg', { code: currentCode, text: txt });
  chatMsg.value = '';
});

// Mark paid (demo)
markPaid.addEventListener('click', () => {
  if(!currentCode) return alert('No order selected');
  fetch(`/api/order/${currentCode}/mark-paid`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({})})
    .then(r=>r.json()).then(()=> appendSystem('Marked as paid (demo)'));
});

// Request refund (demo)
requestRefund.addEventListener('click', () => {
  if(!currentCode) return alert('No order selected');
  fetch(`/api/order/${currentCode}/refund`, { method:'POST' }).then(r=>r.json()).then(()=> appendSystem('Refund requested (demo)'));
});

// helpers
function appendMessage(from, text){
  const d = document.createElement('div');
  d.innerHTML = `<strong>${escapeHtml(from)}:</strong> ${escapeHtml(text)}`;
  chatWindow.appendChild(d);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
function appendSystem(text){
  const d = document.createElement('div');
  d.style.color = '#666';
  d.style.fontStyle = 'italic';
  d.textContent = text;
  chatWindow.appendChild(d);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
