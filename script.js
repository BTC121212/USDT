// script.js
// فرانت‌اند کاملِ لاگین دو مرحله‌ای و داشبورد — بدون PHP — کار با Google Apps Script WebApp
// WebApp مورد استفاده در index.html داخل window.VISA_API_BASE قرار دارد.

(function(){
  const API = (window.VISA_API_BASE || '').replace(/\/+$/,'') + '/?action=';
  const INACTIVITY_MS = 5 * 60 * 1000; // 5 دقیقه

  // عناصر DOM
  const form1 = document.getElementById('form-step1');
  const form2 = document.getElementById('form-step2');
  const err1 = document.getElementById('err-step1');
  const err2 = document.getElementById('err-step2');
  const dashboardArea = document.getElementById('dashboard-area');
  const authArea = document.getElementById('auth-area');

  const appPhoto = document.getElementById('app-photo');
  const photoCaption = document.getElementById('photo-caption');
  const appName = document.getElementById('app-name');
  const appCEU = document.getElementById('app-ceu');
  const btnDownload = document.getElementById('btn-download');
  const downloadTooltip = document.getElementById('download-tooltip');
  const uploadsList = document.getElementById('uploads-list');
  const dashWelcome = document.getElementById('dash-welcome');
  const btnLogout = document.getElementById('btn-logout');
  const btnFinalChecklist = document.getElementById('btn-final-checklist');
  const checklistResult = document.getElementById('checklist-result');

  // ذخیرهٔ محلی نشست
  let sessionToken = sessionStorage.getItem('sessionToken') || null;
  let sessionCEU = sessionStorage.getItem('sessionCEU') || null;
  let inactivityTimer = null;

  // helper: fetch JSON
  async function apiFetch(action, body = null) {
    const url = API + encodeURIComponent(action);
    if (body === null) {
      const r = await fetch(url);
      return r.json();
    } else {
      // POST form-encoded
      const fd = new URLSearchParams();
      for (const k in body) fd.append(k, body[k]);
      const r = await fetch(url, { method: 'POST', body: fd });
      return r.json();
    }
  }

  // نمایش خطا
  function showError(el, text) {
    el.textContent = text || 'خطا';
    el.classList.remove('hidden');
  }
  function hideError(el) { el.textContent = ''; el.classList.add('hidden'); }

  // مدیریت بی‌حرکتی
  function resetInactivity() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      alert('نشست شما به‌خاطر عدم فعالیت منقضی شد.');
      doLogout();
    }, INACTIVITY_MS);
  }
  ['mousemove','keydown','click','touchstart','scroll'].forEach(ev => {
    document.addEventListener(ev, resetInactivity);
  });

  // STEP 1 submit
  form1.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(err1);
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const ceu = document.getElementById('ceu').value.trim();
    if (!username || !password || !ceu) {
      showError(err1, 'لطفاً همهٔ فیلدهای مرحلهٔ اول را پر کنید.');
      return;
    }
    try {
      const resp = await apiFetch('step1', { username, password, ceu });
      if (!resp.ok) {
        showError(err1, resp.error || 'خطای احراز هویت');
        return;
      }
      // ذخیرهٔ ceu برای مرحلهٔ دوم
      sessionStorage.setItem('pendingCEU', ceu);
      // پر کردن فرم مرحلهٔ دوم با دادهٔ برگشتی
      const s2 = resp.step2 || {};
      document.getElementById('s2-name').value = s2.name || '';
      document.getElementById('s2-lastname').value = s2.lastname || '';
      document.getElementById('s2-birthYear').value = s2.birthYear || '';
      document.getElementById('s2-passportNumber').value = s2.passportNumber || '';
      document.getElementById('s2-nationalID').value = s2.nationalID || '';
      document.getElementById('s2-applicationFormNumber').value = s2.applicationFormNumber || '';
      document.getElementById('s2-reference').value = s2.reference || '';
      document.getElementById('s2-applicationType').value = s2.applicationType || '';

      // نمایش مرحلهٔ دوم
      form1.classList.add('hidden');
      form2.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      showError(err1, 'خطا در ارتباط با سرور (WebApp).');
    }
  });

  // back from step2
  document.getElementById('btn-step2-back').addEventListener('click', () => {
    form2.classList.add('hidden');
    form1.classList.remove('hidden');
    hideError(err2);
  });

  // step2 confirm
  document.getElementById('btn-step2-confirm').addEventListener('click', async () => {
    hideError(err2);
    const body = {
      ceu: sessionStorage.getItem('pendingCEU') || '',
      name: document.getElementById('s2-name').value.trim(),
      lastname: document.getElementById('s2-lastname').value.trim(),
      birthYear: document.getElementById('s2-birthYear').value.trim(),
      passportNumber: document.getElementById('s2-passportNumber').value.trim(),
      nationalID: document.getElementById('s2-nationalID').value.trim(),
      applicationFormNumber: document.getElementById('s2-applicationFormNumber').value.trim(),
      reference: document.getElementById('s2-reference').value.trim(),
      applicationType: document.getElementById('s2-applicationType').value.trim()
    };

    // Basic validation
    if (!body.ceu) { showError(err2,'خطا: اطلاعات CEU در دسترس نیست. مرحلهٔ اول را تکرار کنید.'); return; }
    if (!body.name || !body.lastname || !body.birthYear || !body.nationalID || !body.applicationFormNumber || !body.reference || !body.applicationType) {
      showError(err2,'لطفاً همهٔ فیلدهای اجباری مرحلهٔ دوم را پر کنید.');
      return;
    }
    // birthYear: فقط 4 رقم قابل قبول
    if (!/^\d{4}$/.test(body.birthYear)) {
      showError(err2,'سال تولد باید به صورت 4 رقم (YYYY) باشد.');
      return;
    }

    try {
      const resp = await apiFetch('step2', body);
      if (!resp.ok) {
        showError(err2, resp.error || 'اعتبارسنجی مرحلهٔ دوم ناموفق بود.');
        return;
      }
      // موفقیت -> دریافت sessionToken
      sessionToken = resp.sessionToken;
      sessionStorage.setItem('sessionToken', sessionToken);
      sessionStorage.setItem('sessionCEU', body.ceu);
      sessionStorage.removeItem('pendingCEU');
      // بارگذاری داشبورد
      await loadDashboard();
      resetAndStart();
    } catch (err) {
      console.error(err);
      showError(err2, 'خطا در ارتباط با سرور (WebApp).');
    }
  });

  // load dashboard from sessionToken
  async function loadDashboard() {
    if (!sessionToken) {
      showAuth();
      return;
    }
    try {
      const resp = await apiFetch('checkSession&token=' + encodeURIComponent(sessionToken));
      if (!resp.ok) {
        // توکن نامعتبر یا منقضی
        sessionStorage.removeItem('sessionToken');
        sessionStorage.removeItem('sessionCEU');
        sessionToken = null;
        showAuth();
        return;
      }
      const u = resp.user || {};
      // پر کردن UI داشبورد
      appName.textContent = (u.name || '') + ' ' + (u.lastname || '');
      appCEU.textContent = 'CEU: ' + (u.ceuNumber || sessionStorage.getItem('sessionCEU') || '—');
      dashWelcome.textContent = 'خوش آمدید، ' + (u.name || '') + ' ' + (u.lastname || '');

      // عکس
      if (u.photoURL && u.photoURL.startsWith('http')) {
        appPhoto.src = u.photoURL;
        appPhoto.alt = 'عکس متقاضی';
        photoCaption.textContent = '';
        appPhoto.onerror = () => {
          appPhoto.src = '';
          photoCaption.textContent = 'عکس موجود نیست';
          appPhoto.style.display = 'none';
        };
        appPhoto.style.display = '';
      } else {
        appPhoto.src = '';
        appPhoto.style.display = 'none';
        photoCaption.textContent = 'عکس موجود نیست';
      }

      // وضعیت پرداخت — اگر Paid -> فعال
      const paid = (u.paymentStatus || '').toString().trim().toLowerCase() === 'paid';
      btnDownload.disabled = !paid;
      if (paid) {
        downloadTooltip.classList.add('hidden');
      } else {
        downloadTooltip.classList.remove('hidden');
      }

      // لیست آپلودها — طبق ستون‌های پیشنهادی
      const uploadFields = [
        ['uploadPassport','پاسپورت'],
        ['uploadIdentityDocs','مدارک هویتی'],
        ['uploadProofOfDanger','اسناد خطر'],
        ['uploadResidenceDocs','اسناد محل اقامت'],
        ['uploadEducationJobDocs','مدارک تحصیلی/شغلی'],
        ['uploadFingerprints','اثرانگشت'],
        ['uploadPaymentReceipt','رسید پرداخت']
      ];
      uploadsList.innerHTML = '';
      uploadFields.forEach(([fieldKey,label]) => {
        const val = u[fieldKey] || '';
        const row = document.createElement('div');
        row.className = 'upload-row';
        const lbl = document.createElement('div');
        lbl.style.minWidth = '120px';
        lbl.textContent = label + ':';
        row.appendChild(lbl);
        if (val && val.toString().startsWith('http')) {
          const viewBtn = document.createElement('button');
          viewBtn.className = 'small-btn';
          viewBtn.textContent = 'نمایش فایل';
          viewBtn.addEventListener('click', ()=> window.open(val,'_blank'));
          row.appendChild(viewBtn);
          const disabledUpload = document.createElement('button');
          disabledUpload.className = 'small-btn';
          disabledUpload.textContent = 'آپلود (غیرفعال)';
          disabledUpload.disabled = true;
          row.appendChild(disabledUpload);
        } else {
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.id = 'file-'+fieldKey;
          fileInput.style.flex = '1';
          row.appendChild(fileInput);
          const uploadBtn = document.createElement('button');
          uploadBtn.className = 'small-btn';
          uploadBtn.textContent = 'آپلود';
          uploadBtn.addEventListener('click', ()=> handleUpload(fieldKey, fileInput));
          row.appendChild(uploadBtn);
        }
        uploadsList.appendChild(row);
      });

      // پاکسازی خطاها و نمایش داشبورد
      hideError(err1); hideError(err2);
      showDashboard();
    } catch (err) {
      console.error(err);
      sessionStorage.removeItem('sessionToken');
      sessionToken = null;
      showAuth();
    }
  }

  // دانلود نامهٔ ویزا (نمونه)
  btnDownload.addEventListener('click', () => {
    if (btnDownload.disabled) {
      alert('برای دانلود، لطفاً هزینهٔ درخواست ویزای خود را پرداخت نمایید.');
      return;
    }
    // درصورت نیاز: می‌توان WebApp را توسعه داد که لینک رسمی را برگرداند یا فایل را ارسال کند.
    alert('دانلود نامهٔ ویزا: در نسخهٔ فعلی دمو است. لطفاً endpoint دانلود رسمی را در WebApp اضافه کنید.');
  });

  // handleUpload: در این نمونه آپلود واقعی در WebApp پیاده نشده است.
  // => شما باید در Apps Script endpoint ای بنویسید که فایل را (multipart) بگیرد یا فایل را از کاربر به Drive آپلود کند.
  // درحال حاضر این تابع شبیه‌سازی می‌کند و پیغام راهنما نشان می‌دهد.
  async function handleUpload(fieldKey, fileInput) {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      alert('لطفاً یک فایل انتخاب کنید.');
      return;
    }
    // امن‌ترین راه: آپلود از طریق Google Picker / Apps Script که در Drive آپلود کرده و لینک را در ستون مربوطه قرار دهد.
    alert('آپلود شبیه‌سازی شد. برای فعال‌سازی واقعی، WebApp را توسعه دهید تا فایل را در Drive آپلود کرده و لینک را در ستون «' + fieldKey + '» ثبت کند.');
    // بعد از آپلود واقعی، بهتر است کاربر صفحه را رفرش کند یا مجدداً checkSession اجرا شود تا ستون‌ها از شیت خوانده شوند.
  }

  // final checklist
  btnFinalChecklist.addEventListener('click', () => {
    const rows = uploadsList.querySelectorAll('.upload-row');
    const results = [];
    rows.forEach(r => {
      const text = r.textContent || '';
      // اگر در متن 'نمایش فایل' وجود داره یعنی لینک هست
      if (text.includes('نمایش فایل')) {
        results.push('✅ ' + text.split(':')[0].trim());
      } else {
        results.push('⛔ ' + text.split(':')[0].trim() + ' — در انتظار بارگذاری');
      }
    });
    checklistResult.textContent = results.join(' • ');
  });

  // logout
  btnLogout.addEventListener('click', doLogout);

  async function doLogout() {
    try {
      const token = sessionStorage.getItem('sessionToken') || sessionToken || '';
      if (token) await apiFetch('logout', { sessionToken: token });
    } catch(e){ console.warn(e); }
    sessionStorage.removeItem('sessionToken');
    sessionStorage.removeItem('sessionCEU');
    sessionToken = null;
    showAuth();
  }

  // نمایش/پنهان کردن صفحات
  function showAuth(){ authArea.classList.remove('hidden'); dashboardArea.classList.add('hidden'); }
  function showDashboard(){ authArea.classList.add('hidden'); dashboardArea.classList.remove('hidden'); }

  // شروعِ نشست (تایمر بی‌حرکتی)
  function resetAndStart(){ resetInactivity(); }

  // init: اگر sessionToken داریم سعی می‌کنیم مستقیم لاگین کنیم
  (async function init(){
    if (!API || API.indexOf('http') !== 0) {
      alert('خطا: WebApp آدرس‌دهی نشده است. لطفاً window.VISA_API_BASE را در index.html تنظیم کنید.');
      return;
    }
    sessionToken = sessionStorage.getItem('sessionToken') || null;
    if (sessionToken) {
      await loadDashboard();
      resetAndStart();
    } else {
      showAuth();
    }
  })();

})();
