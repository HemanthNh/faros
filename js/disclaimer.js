(() => {
  const cookieName = 'faros_disclaimer_accepted';

  function hasAccepted() {
    return document.cookie.split(';').some(c => c.trim().startsWith(`${cookieName}=`));
  }

  function setAccepted() {
    document.cookie = `${cookieName}=1; path=/; SameSite=Lax`;
  }

  function buildModal() {
    const overlay = document.createElement('div');
    overlay.className = 'disclaimer-overlay';
    overlay.innerHTML = `
      <div class="disclaimer-modal" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
        <h3 id="disclaimer-title">Disclaimer</h3>
        <p>The Bar Council of India does not permit solicitation of work and advertising by legal practitioners and advocates. By accessing the Faros Legal website (our website), the user acknowledges that:</p>
        <ul>
          <li>The user wishes to gain more information about us for his/her information and use. He/She also acknowledges that there has been no attempt by us to advertise or solicit work.</li>
          <li>Any information obtained or downloaded by the user from our website does not lead to the creation of the client–attorney relationship between the Firm and the user.</li>
          <li>None of the information contained in our website amounts to any form of legal opinion or legal advice.</li>
          <li>Our website uses cookies to improve your user experience. By using our site, you agree to our use of cookies. To find out more, please see our Cookies Policy & Privacy Policy.</li>
          <li>All information contained in our website is the intellectual property of the Firm.</li>
        </ul>
        <div class="disclaimer-actions">
          <button type="button" class="btn btn-primary" id="disclaimer-agree">I Agree</button>
        </div>
      </div>
    `;
    return overlay;
  }

  function showDisclaimer() {
    if (hasAccepted()) return;
    const overlay = buildModal();
    document.body.appendChild(overlay);
    document.body.classList.add('no-scroll');
    const agreeBtn = overlay.querySelector('#disclaimer-agree');
    agreeBtn?.addEventListener('click', () => {
      setAccepted();
      document.body.classList.remove('no-scroll');
      overlay.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showDisclaimer);
  } else {
    showDisclaimer();
  }
})();
