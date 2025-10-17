document.addEventListener('DOMContentLoaded', () => {
    
    // ----------------------------------------------------------------
    // 1. Configuration and Global Variables
    // ----------------------------------------------------------------
    
    // **CRITICAL:** REPLACE THIS WITH YOUR PUBLISHED GOOGLE APPS SCRIPT WEB APP URL
    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwFcCIi_ti0ZLtd4-fKb4vBz_VcPi73LxKjhQt-mCARzZNuz3pexh3Ed-l7A9MAufDEWA/exec'; 
    
    // Session timeout (5 minutes in milliseconds)
    const SESSION_TIMEOUT = 5 * 60 * 1000; 
    let sessionTimer = null;
    
    let currentUserData = null; // Full user data upon successful login
    let tempUserData = null;    // Data after successful Step 1 (for use in Step 2)
    
    // Data model for the Final Checklist (key: sheet column name, value: friendly label)
    const DOCUMENT_MODEL = {
        'uploadPassport': 'Passport',
        'uploadIdentityDocs': 'Identity Documents',
        'uploadProofOfDanger': 'Proof of Danger Documents',
        'uploadResidenceDocs': 'Residence Documents',
        'uploadEducationJobDocs': 'Education/Job Documents',
        'uploadFingerprints': 'Fingerprints File',
        'uploadPaymentReceipt': 'Payment Receipt'
    };

    // ----------------------------------------------------------------
    // 2. UX and UI Helper Functions
    // ----------------------------------------------------------------

    /**
     * Display an error/success message to the user
     * @param {string} message - The message text
     * @param {boolean} isSuccess - Is it a success message?
     */
    function showMessage(message, isSuccess = false) {
        const msgArea = document.getElementById('message-area');
        const msgBox = document.getElementById('message-box');
        
        msgBox.textContent = message;
        msgArea.classList.remove('hidden');
        
        if (isSuccess) {
            msgBox.className = 'p-3 rounded-lg text-center font-bold bg-green-100 text-green-800';
        } else {
            msgBox.className = 'p-3 rounded-lg text-center font-bold bg-red-100 text-red-800';
        }

        // Hide message after 5 seconds
        setTimeout(() => msgArea.classList.add('hidden'), 5000);
    }
    
    /**
     * Changes the active view/page
     * @param {string} pageId - The ID of the page section to show (e.g., 'login-step-1')
     */
    function showPage(pageId) {
        document.querySelectorAll('.page-section').forEach(section => {
            if (section.id === pageId) {
                section.classList.remove('hidden');
                // Optional: apply transition classes if needed
            } else {
                section.classList.add('hidden');
            }
        });
        // Re-initialize Lucide icons after page change
        lucide.createIcons();
    }

    /**
     * Toggles the loading screen based on state
     * @param {boolean} isLoading 
     */
    function toggleLoading(isLoading) {
        if (isLoading) {
            showPage('loading-screen');
        } else if (currentUserData) {
            showPage('dashboard');
        } else if (tempUserData) {
            showPage('login-step-2');
        } else {
            showPage('login-step-1');
        }
    }
    
    /**
     * Generates HTML rows for the document checklist table
     * @param {object} user - User data object
     * @returns {string} HTML for table rows
     */
    function generateDocumentRows(user) {
        let html = '';
        for (const [key, label] of Object.entries(DOCUMENT_MODEL)) {
            // Check if the link exists and is not an empty/placeholder string
            const link = user[key];
            const isUploaded = link && link !== 'N/A' && link.trim() !== "";
            
            const statusIcon = isUploaded 
                ? '<span class="icon-ok flex items-center gap-1">✅ Uploaded</span>' 
                : '<span class="icon-error flex items-center gap-1">⛔ Pending</span>';
            
            // Generate the link with a default placeholder if not uploaded
            const fileLink = isUploaded ? link : '#';

            html += `
                <tr class="border-b border-gray-200 hover:bg-gray-100">
                    <td class="py-3 px-6 text-left font-medium">${label}</td>
                    <td class="py-3 px-6 text-center">${statusIcon}</td>
                    <td class="py-3 px-6 text-center flex gap-2 justify-center">
                        <button class="doc-action-button btn-upload" data-key="${key}" ${isUploaded ? 'disabled' : ''}>
                            ${isUploaded ? 'Re-Upload' : 'Upload File'}
                        </button>
                        <a href="${fileLink}" target="_blank" class="doc-action-button btn-view ${isUploaded ? '' : 'disabled'}" ${!isUploaded ? 'disabled' : ''}>
                            View File
                        </a>
                    </td>
                </tr>
            `;
        }
        return html;
    }

    /**
     * Renders the entire dashboard with current user data
     */
    function renderDashboard() {
        if (!currentUserData) return;

        // 1. Main Info
        document.getElementById('user-fullname').textContent = `${currentUserData.name} ${currentUserData.lastname}`;
        document.getElementById('user-ceu').textContent = currentUserData.ceuNumber;
        document.getElementById('applicant-photo').src = currentUserData.photoURL || 'https://placehold.co/300x400/94A3B8/FFFFFF?text=Photo';
        
        // 2. Case Info Table
        const infoTable = document.getElementById('user-info-table');
        infoTable.innerHTML = `
            <tr><td class="font-bold w-1/2 py-1">Application Form No:</td><td class="py-1">${currentUserData.applicationFormNumber}</td></tr>
            <tr><td class="font-bold py-1">National ID:</td><td class="py-1">${currentUserData.nationalID}</td></tr>
            <tr><td class="font-bold py-1">Birth Year:</td><td class="py-1">${currentUserData.birthYear}</td></tr>
            <tr><td class="font-bold py-1">Application Type:</td><td class="py-1">${currentUserData.applicationType}</td></tr>
        `;

        // 3. Payment Status and Download Button
        const isPaid = currentUserData.paymentStatus.toLowerCase() === 'paid';
        const paymentBox = document.getElementById('payment-status-box');
        const downloadBtn = document.getElementById('btn-download-visa');
        
        paymentBox.className = 'p-3 rounded-lg font-bold flex items-center gap-2 ' + (isPaid ? 'status-paid' : 'status-unpaid');
        document.getElementById('payment-icon').innerHTML = isPaid ? '<i data-lucide="check-circle-2" class="h-5 w-5"></i>' : '<i data-lucide="alert-triangle" class="h-5 w-5"></i>';
        document.getElementById('payment-text').textContent = isPaid ? 'Payment is completed.' : 'Awaiting visa fee payment.';
        
        if (isPaid) {
            downloadBtn.classList.remove('disabled');
            downloadBtn.classList.add('bg-green-600');
            downloadBtn.disabled = false;
            downloadBtn.title = 'File is ready for download.';
        } else {
            downloadBtn.classList.remove('bg-green-600');
            downloadBtn.classList.add('disabled');
            downloadBtn.disabled = true;
            downloadBtn.title = 'Please complete your visa application payment to enable download.';
        }

        // 4. Final Document Checklist
        document.getElementById('documents-checklist').innerHTML = generateDocumentRows(currentUserData);
        attachDocumentListeners();
    }

    /**
     * Attaches click listeners to dynamically created upload buttons.
     */
    function attachDocumentListeners() {
        document.querySelectorAll('.btn-upload').forEach(button => {
            button.onclick = (e) => handleDocumentUpload(e, button.getAttribute('data-key'));
        });
        
        // Prevent default click action on disabled 'View File' links
        document.querySelectorAll('.btn-view').forEach(link => {
             if (link.hasAttribute('disabled')) {
                link.onclick = (e) => { e.preventDefault(); showMessage('No file uploaded to view.', false); };
             }
        });
    }

    // ----------------------------------------------------------------
    // 3. Session Management Functions
    // ----------------------------------------------------------------

    function startSessionTimer() {
        if (sessionTimer) {
            clearTimeout(sessionTimer);
        }
        // Set a timeout to log out if there is no activity
        sessionTimer = setTimeout(performLogout, SESSION_TIMEOUT, true);
        console.log(`Session timer started. Timeout in ${SESSION_TIMEOUT / 60000} minutes.`);
    }

    function resetSessionTimer() {
        if (currentUserData) {
            startSessionTimer();
        }
    }

    /**
     * Complete system logout
     * @param {boolean} isTimeout - Was the logout due to inactivity?
     */
    async function performLogout(isTimeout = false) {
        clearTimeout(sessionTimer);
        
        if (isTimeout) {
            showMessage("Your session expired due to inactivity.", false);
        } else {
            showMessage("You have successfully logged out.", true);
        }

        // 1. Send command to server to clear the token
        if (currentUserData) {
            await sendRequest('logout', { ceuNumber: currentUserData.ceuNumber });
        }
        
        // 2. Clear local data
        sessionStorage.removeItem('sessionToken');
        sessionStorage.removeItem('ceuNumber');
        currentUserData = null;
        tempUserData = null;
        
        // 3. Return to the first login page
        showPage('login-step-1');
    }
    
    // Listen for user activity to reset the timer
    document.addEventListener('mousemove', resetSessionTimer);
    document.addEventListener('keypress', resetSessionTimer);
    document.addEventListener('click', resetSessionTimer);
    document.addEventListener('scroll', resetSessionTimer);


    // ----------------------------------------------------------------
    // 4. Google Apps Script Communication
    // ----------------------------------------------------------------

    /**
     * Send an AJAX request to the Google Apps Script Web App
     * @param {string} action - The desired server operation
     * @param {object} payload - Data to send
     */
    async function sendRequest(action, payload = {}) {
        toggleLoading(true);
        try {
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...payload })
            });
            
            const data = await response.json();
            toggleLoading(false);
            return data;

        } catch (error) {
            console.error('API Error:', error);
            toggleLoading(false);
            showMessage("Error connecting to the server. Please check your network connection.", false);
            return { success: false, message: "Network Error." };
        }
    }

    // ----------------------------------------------------------------
    // 5. Login and Dashboard Logic
    // ----------------------------------------------------------------
    
    // --- Handle Login Form 1 Submission ---
    document.getElementById('form-login-1').onsubmit = async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('L1_username').value.trim();
        const password = document.getElementById('L1_password').value.trim();
        const ceuNumber = document.getElementById('L1_ceuNumber').value.trim();
        
        const result = await sendRequest('login1', { username, password, ceuNumber });
        
        if (result.success) {
            tempUserData = result.user;
            
            // Populate hidden fields in form 2 for continuity
            document.getElementById('L2_ceuNumber').value = tempUserData.ceuNumber;
            document.getElementById('L2_rowNumber').value = tempUserData.rowNumber;
            
            showPage('login-step-2');
            showMessage("Step 1 successful. Please complete identity verification.", true);
        } else {
            showMessage(result.message || "Error in Step 1 login.", false);
        }
    };
    
    // --- Handle Login Form 2 Submission ---
    document.getElementById('form-login-2').onsubmit = async (e) => {
        e.preventDefault();
        
        // 1. Client-side validation (e.g., Birth Year format)
        const birthYear = document.getElementById('L2_birthYear').value.trim();
        if (!/^\d{4}$/.test(birthYear)) {
            showMessage("Birth Year must be a 4-digit number.", false);
            return;
        }

        // 2. Prepare payload for Step 2
        const payload = {
            ceuNumber: tempUserData.ceuNumber,
            rowNumber: tempUserData.rowNumber,
            name: document.getElementById('L2_name').value.trim(),
            lastname: document.getElementById('L2_lastname').value.trim(),
            birthYear: birthYear,
            passportNumber: document.getElementById('L2_passportNumber').value.trim(),
            nationalID: document.getElementById('L2_nationalID').value.trim(),
            applicationFormNumber: document.getElementById('L2_applicationFormNumber').value.trim(),
            reference: document.getElementById('L2_reference').value.trim(),
            applicationType: document.getElementById('L2_applicationType').value.trim()
        };
        
        // 3. Send to server for final validation and token generation
        const result = await sendRequest('login2', payload);

        if (result.success) {
            currentUserData = result.user;
            
            // Store session in browser
            sessionStorage.setItem('sessionToken', result.token);
            sessionStorage.setItem('ceuNumber', currentUserData.ceuNumber);
            
            // Start timer and show dashboard
            renderDashboard();
            startSessionTimer();
            showPage('dashboard');
            showMessage("Login successful. Welcome to the dashboard!", true);

        } else {
            showMessage(result.message || "Error in data matching. Please ensure all 8 fields are exact.", false);
        }
    };
    
    // --- Document Upload Handler (Mock Implementation) ---
    async function handleDocumentUpload(e, key) {
        e.preventDefault();
        
        if (!currentUserData) return;

        // In a real environment, file selection and Google Drive upload logic would go here.
        // For demonstration, we simulate the process by generating a mock link.
        const mockLink = `https://mock-drive.com/${currentUserData.ceuNumber}/${key}-${Date.now()}.pdf`; 
        
        const result = await sendRequest('updateDocument', {
            ceuNumber: currentUserData.ceuNumber,
            token: sessionStorage.getItem('sessionToken'),
            documentKey: key,
            linkValue: mockLink // Mock link value for testing
        });

        if (result.success) {
            currentUserData = result.user; // Update user data with new link
            renderDashboard(); // Re-render to update the checklist status
            showMessage(`Document ${DOCUMENT_MODEL[key]} uploaded successfully.`, true);
        } else {
            showMessage(result.message || "Error updating document status.", false);
        }
    }

    // --- Logout Button Listener ---
    document.getElementById('btn-logout').onclick = () => performLogout(false);

    // ----------------------------------------------------------------
    // 6. Initial Application Load and Session Check
    // ----------------------------------------------------------------

    async function initialize() {
        const token = sessionStorage.getItem('sessionToken');
        const ceu = sessionStorage.getItem('ceuNumber');
        
        // Ensure Lucide icons are ready
        lucide.createIcons();

        if (token && ceu) {
            // Attempt to validate existing session
            const result = await sendRequest('validateSession', { token, ceuNumber: ceu });
            
            if (result.success) {
                currentUserData = result.user;
                renderDashboard();
                startSessionTimer();
                showPage('dashboard');
                showMessage("Active session restored.", true);
            } else {
                // Invalid session, clear tokens and go to login
                sessionStorage.removeItem('sessionToken');
                sessionStorage.removeItem('ceuNumber');
                showPage('login-step-1');
                showMessage(result.message || "Session expired. Please log in.", false);
            }
        } else {
            // No session found, start at step 1
            showPage('login-step-1');
        }
    }

    initialize();

});
