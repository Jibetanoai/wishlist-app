// Netlify Formsへ画面遷移なしで送信する(Netlify公式のAJAX送信パターン)。
function encodeFormData(form) {
  return new URLSearchParams(new FormData(form)).toString();
}

const contactForm = document.getElementById('contactForm');
const contactStatus = document.getElementById('contactStatus');

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = contactForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  contactStatus.hidden = true;

  try {
    const res = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encodeFormData(contactForm),
    });
    if (!res.ok) throw new Error();
    contactForm.hidden = true;
    contactStatus.textContent = '送信したよ。ありがとう!';
    contactStatus.hidden = false;
  } catch {
    contactStatus.textContent = '送信に失敗したよ。時間をおいてもう一度試してね。';
    contactStatus.hidden = false;
    submitBtn.disabled = false;
  }
});
