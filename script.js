// --- SUPABASE CONNECTION ---
// Paste your ACTUAL URL and KEY here (from the Supabase website)
const supabaseUrl = 'https://YOUR_PROJECT_URL.supabase.co'; 
const supabaseKey = 'YOUR_LONG_ANON_KEY_HERE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let inventoryData = []; // Starts empty, fills from database

// 1. Check Login & Load Data
async function initializeApp() {
    // Check if user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    
    // If on dashboard but not logged in -> Go to login
    if (window.location.pathname.includes('dashboard.html') && !session) {
        window.location.href = 'login.html';
        return;
    }

    // If logged in, load their data
    if (session && window.location.pathname.includes('dashboard.html')) {
        loadUserProfile(session.user.id);
        await fetchInventory(session.user.id);
    }
    
    // Initialize other page animations
    if (window.location.pathname.includes('index.html')) {
        initializeLandingPage();
    }
}

// 2. Fetch Real Inventory from Supabase
async function fetchInventory(userId) {
    const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', userId); // Only get THIS user's items

    if (error) {
        console.error('Error fetching data:', error);
    } else {
        // Convert Database format to your App format
        inventoryData = data.map(item => ({
            id: item.id,
            medicineName: item.name,
            quantity: item.quantity,
            expiryDate: new Date(item.expiry_date),
            value: item.unit_price * item.quantity,
            status: getMedicineStatus(new Date(item.expiry_date))
        }));
        
        // Update the UI
        renderInventoryTable();
        updateStats();
        initializeCharts();
    }
}

// 3. Add New Medicine (Connects to "Add Medicine" Modal)
async function addNewMedicine() {
    const name = document.getElementById('medicineName').value;
    const quantity = parseInt(document.getElementById('medicineQuantity').value);
    const price = parseFloat(document.getElementById('medicinePrice').value);
    const expiryDate = document.getElementById('medicineExpiry').value;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('inventory')
        .insert([{
            name: name,
            quantity: quantity,
            unit_price: price,
            expiry_date: expiryDate,
            user_id: user.id
        }]);

    if (error) {
        alert("Error adding: " + error.message);
    } else {
        await fetchInventory(user.id); // Refresh list
        closeAddMedicineModal();
        alert(`${name} added!`);
    }
}

// Helper to load profile name
async function loadUserProfile(userId) {
    const { data } = await supabase
        .from('profiles')
        .select('owner_name')
        .eq('id', userId)
        .single();
        
    if (data) {
        document.getElementById('userName').textContent = data.owner_name;
        document.getElementById('greetingName').textContent = data.owner_name.split(' ')[0];
    }
}

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadUserData();
});

function initializeApp() {
    // Landing Page Animations
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        initializeLandingPage();
    }
    
    // Login Page Functionality
    if (window.location.pathname.includes('login.html')) {
        initializeLoginPage();
    }
    
    // Dashboard Functionality
    if (window.location.pathname.includes('dashboard.html')) {
        initializeDashboard();
    }
}

// Landing Page Functions
function initializeLandingPage() {
    // Animate feature cards on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.feature-card').forEach(card => {
        observer.observe(card);
    });
}

// Add Medicine Modal Functions
function openAddMedicineModal() {
    const modal = document.getElementById('addMedicineModal');
    modal.classList.add('active');
}

function closeAddMedicineModal() {
    const modal = document.getElementById('addMedicineModal');
    modal.classList.remove('active');
    document.getElementById('addMedicineForm').reset();
}

// Add Medicine Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const addMedicineForm = document.getElementById('addMedicineForm');
    if (addMedicineForm) {
        addMedicineForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addNewMedicine();
        });
    }
});

function addNewMedicine() {
    const name = document.getElementById('medicineName').value;
    const quantity = parseInt(document.getElementById('medicineQuantity').value);
    const price = parseFloat(document.getElementById('medicinePrice').value);
    const expiryDate = new Date(document.getElementById('medicineExpiry').value);
    
    const newMedicine = {
        id: inventoryData.length > 0 ? Math.max(...inventoryData.map(item => item.id)) + 1 : 1,
        medicineName: name,
        quantity: quantity,
        expiryDate: expiryDate,
        value: quantity * price,
        status: getMedicineStatus(expiryDate)
    };
    
    inventoryData.push(newMedicine);
    renderInventoryTable();
    updateStats();
    initializeCharts();
    closeAddMedicineModal();
    
    showNotification(`${name} added successfully to inventory!`);
}

function removeMedicine(id) {
    const item = inventoryData.find(item => item.id === id);
    if (item && confirm(`Are you sure you want to remove ${item.medicineName} from inventory?`)) {
        inventoryData = inventoryData.filter(item => item.id !== id);
        renderInventoryTable();
        updateStats();
        initializeCharts();
        showNotification(`${item.medicineName} removed from inventory`);
    }
}

function getMedicineStatus(expiryDate) {
    const today = new Date();
    const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
        return 'expired';
    } else if (daysUntilExpiry <= 30) {
        return 'warning';
    } else {
        return 'safe';
    }
}

// User Data Functions
function loadUserData() {
    const userName = localStorage.getItem('userName') || 'Guest';
    updateUserName(userName);
}

function updateUserName(name) {
    const userNameElement = document.getElementById('userName');
    const greetingNameElement = document.getElementById('greetingName');
    
    if (userNameElement) userNameElement.textContent = name;
    if (greetingNameElement) greetingNameElement.textContent = name.split(' ')[0];
    
    localStorage.setItem('userName', name);
}

// Add name input functionality on login
function initializeLoginPage() {
    // Toggle between Login and Signup
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const formType = this.dataset.form;
            
            // Update active button
            toggleBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Toggle forms
            if (formType === 'login') {
                loginForm.classList.remove('hidden');
                signupForm.classList.add('hidden');
            } else {
                loginForm.classList.add('hidden');
                signupForm.classList.remove('hidden');
            }
        });
    });
    
    // Form submissions
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const email = loginForm.querySelector('input[type="email"]').value;
        const userName = email.split('@')[0];
        updateUserName(userName);
        window.location.href = 'dashboard.html';
    });
    
    signupForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const nameInput = signupForm.querySelector('input[type="text"]');
        const userName = nameInput ? nameInput.value : 'User';
        updateUserName(userName);
        window.location.href = 'dashboard.html';
    });
}

// Dashboard Functions
function initializeDashboard() {
    // Navigation
    initializeNavigation();
    
    // Render inventory table
    renderInventoryTable();
    
    // Initialize charts
    initializeCharts();
    
    // Update stats
    updateStats();
    
    // Add animations
    addDashboardAnimations();
}

function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            const section = this.dataset.section;
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding section
            contentSections.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${section}-section`) {
                    content.classList.add('active');
                }
            });
        });
    });
}

function renderInventoryTable() {
    const tbody = document.getElementById('inventory-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    inventoryData.forEach(item => {
        const row = document.createElement('tr');
        
        const statusBadge = getStatusBadge(item.status);
        const actionButton = getActionButton(item.status, item.id);
        const removeButton = `<button class="remove-btn" onclick="removeMedicine(${item.id})">Remove</button>`;
        
        row.innerHTML = `
            <td><strong>${item.medicineName}</strong></td>
            <td>${item.quantity}</td>
            <td>${item.expiryDate.toLocaleDateString()}</td>
            <td>₹${item.value.toLocaleString()}</td>
            <td>${statusBadge}</td>
            <td>${actionButton}</td>
            <td>${removeButton}</td>
        `;
        
        tbody.appendChild(row);
    });
}

function getStatusBadge(status) {
    const badges = {
        expired: '<span class="status-badge expired">Expired</span>',
        warning: '<span class="status-badge warning">Expiring Soon</span>',
        safe: '<span class="status-badge safe">Safe</span>'
    };
    return badges[status] || badges.safe;
}

function getActionButton(status, itemId) {
    const buttons = {
        expired: `<button class="action-btn return" onclick="handleAction('return', ${itemId})">Return to Vendor</button>`,
        warning: `<button class="action-btn sale" onclick="handleAction('sale', ${itemId})">Start Flash Sale</button>`,
        safe: `<button class="action-btn no-action" disabled>No Action</button>`
    };
    return buttons[status] || buttons.safe;
}

function handleAction(action, itemId) {
    const item = inventoryData.find(i => i.id === itemId);
    if (!item) return;
    
    let message = '';
    switch(action) {
        case 'return':
            message = `Return request initiated for ${item.medicineName} (₹${item.value.toLocaleString()})`;
            break;
        case 'sale':
            message = `Flash sale started for ${item.medicineName} - ${item.quantity} units at 50% off!`;
            break;
    }
    
    showNotification(message);
}

function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, var(--primary-green), var(--secondary-teal));
        color: var(--bg-primary);
        padding: 15px 20px;
        border-radius: 12px;
        box-shadow: 0 15px 30px rgba(0,0,0,0.3);
        z-index: 1000;
        max-width: 300px;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    // Add animation
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function updateStats() {
    const expired = inventoryData.filter(item => item.status === 'expired').length;
    const warning = inventoryData.filter(item => item.status === 'warning').length;
    const safe = inventoryData.filter(item => item.status === 'safe').length;
    
    const totalLoss = inventoryData
        .filter(item => item.status === 'expired')
        .reduce((sum, item) => sum + item.value, 0);
    
    // Update stat cards if they exist
    const statValues = document.querySelectorAll('.stat-value');
    if (statValues.length >= 4) {
        statValues[0].textContent = `${expired} items`;
        statValues[1].textContent = `${warning} items`;
        statValues[2].textContent = `${safe} items`;
        statValues[3].textContent = `₹${totalLoss.toLocaleString()}`;
    }
}

function initializeCharts() {
    // Simple chart visualization using CSS
    createPieChart();
    createBarChart();
}

function createPieChart() {
    const canvas = document.getElementById('pieChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const data = {
        expired: inventoryData.filter(item => item.status === 'expired').length,
        warning: inventoryData.filter(item => item.status === 'warning').length,
        safe: inventoryData.filter(item => item.status === 'safe').length
    };
    
    // Simple pie chart drawing
    const total = data.expired + data.warning + data.safe;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;
    
    let currentAngle = 0;
    
    // Draw expired section
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + (data.expired / total) * 2 * Math.PI);
    ctx.lineTo(centerX, centerY);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    currentAngle += (data.expired / total) * 2 * Math.PI;
    
    // Draw warning section
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + (data.warning / total) * 2 * Math.PI);
    ctx.lineTo(centerX, centerY);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    currentAngle += (data.warning / total) * 2 * Math.PI;
    
    // Draw safe section
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + (data.safe / total) * 2 * Math.PI);
    ctx.lineTo(centerX, centerY);
    ctx.fillStyle = '#10b981';
    ctx.fill();
}

function createBarChart() {
    const canvas = document.getElementById('barChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const data = [45000, 38000, 52000, 48000, 35000, 42000]; // Mock monthly loss data
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    
    const barWidth = 40;
    const spacing = 20;
    const maxHeight = 100;
    const maxValue = Math.max(...data);
    
    data.forEach((value, index) => {
        const barHeight = (value / maxValue) * maxHeight;
        const x = index * (barWidth + spacing) + 20;
        const y = canvas.height - barHeight - 20;
        
        // Draw bar
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Draw label
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(labels[index], x + barWidth / 2, canvas.height - 5);
    });
}

function addDashboardAnimations() {
    // Animate stat cards on load
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
    
    // Animate table rows
    const tableRows = document.querySelectorAll('.inventory-table tbody tr');
    tableRows.forEach((row, index) => {
        row.style.opacity = '0';
        row.style.transform = 'translateX(-20px)';
        setTimeout(() => {
            row.style.transition = 'all 0.3s ease';
            row.style.opacity = '1';
            row.style.transform = 'translateX(0)';
        }, index * 50);
    });
}

// Utility Functions
function togglePassword(button) {
    const input = button.previousElementSibling;
    const eyeIcon = button.querySelector('.eye-icon');
    
    if (input.type === 'password') {
        input.type = 'text';
        eyeIcon.textContent = '🙈';
    } else {
        input.type = 'password';
        eyeIcon.textContent = '👁️';
    }
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add parallax effect to background orbs
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const orbs = document.querySelectorAll('.gradient-orb');
    
    orbs.forEach((orb, index) => {
        const speed = 0.5 + (index * 0.1);
        orb.style.transform = `translateY(${scrolled * speed}px)`;
    });
});

// Add hover effect to interactive elements
document.addEventListener('DOMContentLoaded', () => {
    const interactiveElements = document.querySelectorAll('button, .nav-item, .stat-card, .feature-card');
    
    interactiveElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.02)';
        });
        
        element.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
});
