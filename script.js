// MindPalace MVP Frontend - Rustic Vanilla JS Implementation
// Supabase client initialization (placeholders to be replaced by subagent)
const supabaseUrl = '__SUPABASE_URL__';
const supabaseAnonKey = '__SUPABASE_ANON_KEY__';
const supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);

// State variables
let currentUser = null;
let userType = null; // 'professional' or 'patient'
let professionalType = null; // 'psychologist' or 'psychiatrist'
let professionalId = null; // id from professionals table
let patientId = null; // auth user id for patient
let connectionCode = null;

// UI rendering functions
const appDiv = document.getElementById('app');

function clearApp() {
  appDiv.innerHTML = '';
}

function showAuthForms() {
  clearApp();
  const html = `
    <h2>MindPalace MVP</h2>
    <div>
      <h3>Signup</h3>
      <input type="email" id="signup-email" placeholder="Email">
      <input type="password" id="signup-password" placeholder="Password">
      <button id="signup-btn">Sign Up</button>
    </div>
    <div>
      <h3>Login</h3>
      <input type="email" id="login-email" placeholder="Email">
      <input type="password" id="login-password" placeholder="Password">
      <button id="login-btn">Login</button>
    </div>
  `;
  appDiv.innerHTML = html;
  document.getElementById('signup-btn').onclick = handleSignup;
  document.getElementById('login-btn').onclick = handleLogin;
}

async function handleSignup() {
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const { user, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    alert('Signup error: ' + error.message);
    return;
  }
  // Determine user type via prompt (for simplicity, ask if professional)
  const isProf = confirm('Are you a professional? (OK for professional, Cancel for patient)');
  if (isProf) {
    const type = prompt('Enter professional type (psychologist or psychiatrist):');
    if (!type || !(type === 'psychologist' || type === 'psychiatrist')) {
      alert('Invalid type');
      return;
    }
    professionalType = type;
    // Insert into professionals table
    const { error: profError } = await supabase
      .from('professionals')
      .insert({ id: user.id, professional_type: type });
    if (profError) {
      alert('Professional insert error: ' + profError.message);
      return;
    }
    userType = 'professional';
  } else {
    userType = 'patient';
  }
  currentUser = user;
  await loadDashboard();
}

async function handleLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const { user, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Login error: ' + error.message);
    return;
  }
  currentUser = user;
  // Fetch professional type if exists
  const { data: profData, error: profError } = await supabase
    .from('professionals')
    .select('professional_type, id')
    .eq('id', user.id)
    .single();
  if (!profError && profData) {
    userType = 'professional';
    professionalType = profData.professional_type;
    professionalId = profData.id;
  } else {
    userType = 'patient';
    patientId = user.id;
  }
  await loadDashboard();
}

async function loadDashboard() {
  clearApp();
  if (userType === 'professional') {
    renderProfessionalDashboard();
  } else {
    renderPatientView();
  }
}

// Professional Dashboard
function renderProfessionalDashboard() {
  const html = `
    <h2>Professional Dashboard (${professionalType})</h2>
    <div id="connection-code-section"></div>
    <div id="patient-links-section"></div>
    <div id="data-requests-section"></div>
    <div id="data-view-section"></div>
    <button id="logout-btn">Logout</button>
  `;
  appDiv.innerHTML = html;
  document.getElementById('logout-btn').onclick = logout;
  loadConnectionCode();
  loadPatientLinks();
  loadDataRequestsSection();
  loadDataViewSection();
}

// Load connection code from professionals table
async function loadConnectionCode() {
  const { data, error } = await supabase
    .from('professionals')
    .select('connection_code')
    .eq('id', professionalId)
    .single();
  if (!error && data && data.connection_code) {
    connectionCode = data.connection_code;
    document.getElementById('connection-code-section').innerHTML =
      `<p>Your connection code: <strong>${connectionCode}</strong></p>`;
  } else {
    document.getElementById('connection-code-section').innerHTML =
      '<p>No connection code generated yet.</p>';
  }
}

// Load patient links (pending and active)
async function loadPatientLinks() {
  const { data, error } = await supabase
    .from('patient_professional_links')
    .select(`
      id,
      patient_id,
      status,
      patients!inner (id, email)
    `)
    .eq('professional_id', professionalId);
  if (error) {
    console.error('Error loading patient links:', error);
    return;
  }
  const pending = data.filter(l => l.status === 'pending');
  const active = data.filter(l => l.status === 'active');
  let html = '<h3>Patient Connections</h3>';
  if (pending.length > 0) {
    html += '<h4>Pending Requests</h4><ul>';
    pending.forEach(link => {
      html += `<li>
        Patient: ${link.patients.email} 
        <button onclick="acceptLink('${link.id}')">Accept</button>
        <button onclick="rejectLink('${link.id}')">Reject</button>
      </li>`;
    });
    html += '</ul>';
  }
  if (active.length > 0) {
    html += '<h4>Active Connections</h4><ul>';
    active.forEach(link => {
      html += `<li>Patient: ${link.patients.email} (Active)</li>`;
    });
    html += '</ul>';
  }
  document.getElementById('patient-links-section').innerHTML = html;
}

// Accept/reject link functions (global for simplicity)
window.acceptLink = async function(linkId) {
  const { error } = await supabase
    .from('patient_professional_links')
    .update({ status: 'active' })
    .eq('id', linkId);
  if (!error) {
    alert('Link accepted');
    loadPatientLinks();
  } else {
    alert('Error accepting link: ' + error.message);
  }
};

window.rejectLink = async function(linkId) {
  const { error } = await supabase
    .from('patient_professional_links')
    .update({ status: 'rejected' })
    .eq('id', linkId);
  if (!error) {
    alert('Link rejected');
    loadPatientLinks();
  } else {
    alert('Error rejecting link: ' + error.message);
  }
};

// Data Requests Section
function loadDataRequestsSection() {
  const html = `
    <h3>Send Data Request</h3>
    <div id="request-form"></div>
  `;
  document.getElementById('data-requests-section').innerHTML = html;
  renderRequestForm();
}

async function renderRequestForm() {
  // Get active patients
  const { data: patientsData, error: patientsError } = await supabase
    .from('patient_professional_links')
    .select(`
      patient_id,
      patients!inner (id, email)
    `)
    .eq('professional_id', professionalId)
    .eq('status', 'active');
  if (patientsError) {
    console.error('Error fetching patients:', patientsError);
    return;
  }
  const patients = patientsData.map(p => ({ id: p.patient_id, email: p.patients.email }));
  // Determine allowed data types based on professionalType
  let allowedTypes = [];
  if (professionalType === 'psychologist') {
    allowedTypes = ['mood_scale', 'text_diary', 'anxiety_scale', 'sleep_log'];
  } else if (professionalType === 'psychiatrist') {
    allowedTypes = ['sleep_log', 'medication_log', 'side_effects_scale', 'psychosis_screening', 'weight_kg'];
  }
  const frequencies = ['diária', 'semanal'];
  const formHtml = `
    <label>Patient:
      <select id="request-patient">
        <option value="">Select patient</option>
        ${patients.map(p => `<option value="${p.id}">${p.email}</option>`).join('')}
      </select>
    </label>
    <label>Data Type:
      <select id="request-type">
        <option value="">Select type</option>
        ${allowedTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
      </select>
    </label>
    <label>Frequency:
      <select id="request-frequency">
        <option value="">Select frequency</option>
        ${frequencies.map(f => `<option value="${f}">${f}</option>`).join('')}
      </select>
    </label>
    <button id="send-request-btn">Send Request</button>
  `;
  document.getElementById('request-form').innerHTML = formHtml;
  document.getElementById('send-request-btn').onclick = async () => {
    const patientId = document.getElementById('request-patient').value;
    const type = document.getElementById('request-type').value;
    const frequency = document.getElementById('request-frequency').value;
    if (!patientId || !type || !frequency) {
      alert('Please fill all fields');
      return;
    }
    const { error } = await supabase
      .from('data_requests')
      .insert({
        professional_id: professionalId,
        patient_id: patientId,
        data_type: type,
        frequency: frequency,
        status: 'pending'
      });
    if (!error) {
      alert('Request sent');
      // Optionally refresh requests list
    } else {
      alert('Error sending request: ' + error.message);
    }
  };
}

// Data View Section (Tab: Dados dos Pacientes)
function loadDataViewSection() {
  const html = `
    <h3>Dados dos Pacientes</h3>
    <div id="data-table-container"></div>
  `;
  document.getElementById('data-view-section').innerHTML = html;
  loadDataTable();
}

async function loadDataTable() {
  // Fetch data_entries joined with data_requests and patients for this professional's requests
  const { data, error } = await supabase
    .from('data_entries')
    .select(`
      id,
      content,
      created_at,
      data_requests!inner (
        id,
        data_type,
        frequency,
        patients!inner (id, email),
        professionals!inner (id, professional_type)
      )
    `)
    .eq('data_requests.professionals.id', professionalId);
  if (error) {
    console.error('Error loading data entries:', error);
    document.getElementById('data-table-container').innerHTML = '<p>Error loading data.</p>';
    return;
  }
  // Filter by professionalType (should already be enforced by RLS, but double-check)
  const filtered = data.filter(entry => {
    const profType = entry.data_requests.professionals.professional_type;
    return profType === professionalType;
  });
  let html = '<table border="1"><thead><tr><th>Patient</th><th>Type</th><th>Frequency</th><th>Content</th><th>Date</th></tr></thead><tbody>';
  if (filtered.length === 0) {
    html += '<tr><td colspan="5">No data entries</td></tr>';
  } else {
    filtered.forEach(entry => {
      html += `<tr>
        <td>${entry.data_requests.patients.email}</td>
        <td>${entry.data_requests.data_type}</td>
        <td>${entry.data_requests.frequency}</td>
        <td>${JSON.stringify(entry.content)}</td>
        <td>${new Date(entry.created_at).toLocaleString()}</td>
      </tr>`;
    });
  }
  html += '</tbody></table>';
  document.getElementById('data-table-container').innerHTML = html;
}

// Patient View
function renderPatientView() {
  const html = `
    <h2>Patient View</h2>
    <div id="connection-section"></div>
    <div id="requests-section"></div>
    <div id="data-entry-section"></div>
    <button id="logout-btn">Logout</button>
  `;
  appDiv.innerHTML = html;
  document.getElementById('logout-btn').onclick = logout;
  renderConnectionSection();
  startPendingRequestsPoll();
  startDataEntryPoll(); // for reminding about allowed requests
}

// Connection Section: input code and connect
function renderConnectionSection() {
  const html = `
    <h3>Connect to Professional</h3>
    <input type="text" id="connection-code-input" placeholder="Connection code">
    <button id="connect-btn">Connect</button>
  `;
  document.getElementById('connection-section').innerHTML = html;
  document.getElementById('connect-btn').onclick = async () => {
    const code = document.getElementById('connection-code-input').value.trim();
    if (!code) {
      alert('Please enter connection code');
      return;
    }
    // Find professional by connection_code
    const { data: profData, error } = await supabase
      .from('professionals')
      .select('id, professional_type')
      .eq('connection_code', code)
      .single();
    if (error || !profData) {
      alert('Invalid connection code');
      return;
    }
    const professionalId = profData.id;
    // Insert link with status pending
    const { error: linkError } = await supabase
      .from('patient_professional_links')
      .insert({
        patient_id: patientId,
        professional_id: professionalId,
        status: 'pending'
      });
    if (!linkError) {
      alert('Connection request sent. Awaiting professional acceptance.');
    } else {
      alert('Error sending connection request: ' + linkError.message);
    }
  };
}

// Poll for pending data requests (patient side)
function startPendingRequestsPoll() {
  setInterval(async () => {
    if (!patientId) return;
    const { data, error } = await supabase
      .from('data_requests')
      .select(`
        id,
        data_type,
        frequency,
        professionals!inner (id, professional_type)
      `)
      .eq('patient_id', patientId)
      .eq('status', 'pending');
    if (error) {
      console.error('Error fetching pending requests:', error);
      return;
    }
    renderRequestsSection(data);
  }, 5000);
}

function renderRequestsSection(requests) {
  const container = document.getElementById('requests-section');
  if (!requests || requests.length === 0) {
    container.innerHTML = '<p>No pending data requests.</p>';
    return;
  }
  let html = '<h3>Pending Data Requests</h3>';
  requests.forEach(req => {
    html += `
      <div class="request-item">
        <p>${req.professionals.professional_type} pediu para você preencher ${req.data_type} ${req.frequency}. Permitir?</p>
        <button onclick="allowRequest('${req.id}')">Permitir</button>
        <button onclick="denyRequest('${req.id}')">Negar</button>
      </div>
    `;
  });
  container.innerHTML = html;
}

// Allow/deny request functions
window.allowRequest = async function(requestId) {
  const { error } = await supabase
    .from('data_requests')
    .update({ status: 'allowed' })
    .eq('id', requestId);
  if (!error) {
    alert('Request allowed. You will be reminded to enter data.');
    // Start reminder interval for this request (simplified: we'll just show form immediately)
    showDataEntryForm(requestId);
  } else {
    alert('Error allowing request: ' + error.message);
  }
};

window.denyRequest = async function(requestId) {
  const { error } = await supabase
    .from('data_requests')
    .update({ status: 'denied' })
    .eq('id', requestId);
  if (!error) {
    alert('Request denied');
    // UI will update on next poll
  } else {
    alert('Error denying request: ' + error.message);
  }
};

// Show data entry form based on data_type (we need to know type and frequency)
// We'll fetch request details again or store globally; for simplicity, we'll fetch.
async function showDataEntryForm(requestId) {
  const { data, error } = await supabase
    .from('data_requests')
    .select('data_type, frequency')
    .eq('id', requestId)
    .single();
  if (error) {
    console.error('Error fetching request details:', error);
    return;
  }
  const { data_type, frequency } = data;
  const container = document.getElementById('data-entry-section');
  container.innerHTML = `<h4>Enter ${data_type}</h4>`;
  let formHtml = '';
  switch (data_type) {
    case 'mood_scale':
    case 'anxiety_scale':
      formHtml = `
        <label>Score (1-10):
          <select id="entry-value">
            ${Array.from({length: 10}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join('')}
          </select>
        </label>
      `;
      break;
    case 'text_diary':
      formHtml = `
        <label>Diary Entry:
          <textarea id="entry-text" rows="4"></textarea>
        </label>
      `;
      break;
    case 'medication_log':
      formHtml = `
        <label>
          <input type="checkbox" id="entry-took"> Took medication?
        </label>
        <label>Time:
          <input type="time" id="entry-time" disabled>
        </label>
      `;
      break;
    case 'sleep_log':
    case 'weight_kg':
      formHtml = `
        <label>${data_type === 'sleep_log' ? 'Sleep time' : 'Weight (kg)'}:
          <input type="${data_type === 'sleep_log' ? 'time' : 'number'}" id="entry-value">
        </label>
      `;
      break;
    case 'side_effects_scale':
    case 'psychosis_screening':
      formHtml = `
        <label>Score (1-10):
          <select id="entry-value">
            ${Array.from({length: 10}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join('')}
          </select>
        </label>
      `;
      break;
    default:
      formHtml = '<p>Unsupported data type</p>';
  }
  formHtml += `<button id="submit-entry-btn">Submit</button>`;
  container.innerHTML += formHtml;
  // Handle medication log checkbox enabling time input
  if (data_type === 'medication_log') {
    const tookCheckbox = document.getElementById('entry-took');
    const timeInput = document.getElementById('entry-time');
    tookCheckbox.onchange = () => {
      timeInput.disabled = !tookCheckbox.checked;
    };
  }
  document.getElementById('submit-entry-btn').onclick = async () => {
    let content = {};
    switch (data_type) {
      case 'mood_scale':
      case 'anxiety_scale':
      case 'side_effects_scale':
      case 'psychosis_screening':
        content = { score: parseInt(document.getElementById('entry-value').value) };
        break;
      case 'text_diary':
        content = { text: document.getElementById('entry-text').value };
        break;
      case 'medication_log':
        const took = document.getElementById('entry-took').checked;
        content = { took };
        if (took) {
          content.time = document.getElementById('entry-time').value;
        }
        break;
      case 'sleep_log':
        content = { time: document.getElementById('entry-value').value };
        break;
      case 'weight_kg':
        content = { weight: parseFloat(document.getElementById('entry-value').value) };
        break;
    }
    const { error } = await supabase
      .from('data_entries')
      .insert({
        data_request_id: requestId,
        patient_id: patientId,
        content
      });
    if (!error) {
      alert('Data submitted');
      container.innerHTML = '<p>Data submitted. Waiting for next reminder.</p>';
      // In a real app, we would set interval for reminders based on frequency.
      // For simplicity, we just clear form.
    } else {
      alert('Error submitting data: ' + error.message);
    }
  };
}

// Poll for allowed requests to show reminders (simplified: we just show form immediately after allowing)
// In a more complete implementation, we would use setInterval to remind based on frequency.
// For MVP, we skip automatic reminders and rely on user to submit after allowing.

// Logout
function logout() {
  supabase.auth.signOut();
  currentUser = null;
  userType = null;
  professionalType = null;
  professionalId = null;
  patientId = null;
  connectionCode = null;
  showAuthForms();
}

// Initialize
showAuthForms();