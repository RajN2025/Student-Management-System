// Student Management System - Main JS

document.addEventListener('DOMContentLoaded', () => {
    // 1. Theme Toggle Logic
    initTheme();

    // 2. Active Route Highlight
    highlightActiveNav();

    // 3. Form Validation (if forms exist)
    setupFormValidation();

    // 4. Dynamic Live Search (if table exists)
    setupTableSearch();

    // 5. Dashboard Charts (if elements exist)
    initDashboardCharts();
});

// Theme Management
function initTheme() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (!themeToggleBtn) return;

    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeButtonText(currentTheme);

    themeToggleBtn.addEventListener('click', () => {
        const activeTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = activeTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeButtonText(newTheme);
        
        // Redraw charts if we are on dashboard to match updated theme grid lines
        if (typeof window.classAverageChart !== 'undefined') {
            location.reload(); // Quick refresh to adapt Chart.js theme styling
        }
    });
}

function updateThemeButtonText(theme) {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (!themeToggleBtn) return;
    
    if (theme === 'light') {
        themeToggleBtn.innerHTML = '🌙 Dark Mode';
    } else {
        themeToggleBtn.innerHTML = '☀️ Light Mode';
    }
}

// Sidebar Active Navigation Link
function highlightActiveNav() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-item');
    
    navLinks.forEach(item => {
        const link = item.querySelector('a');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (currentPath === href || (href !== '/' && currentPath.startsWith(href))) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Client Side Form Validation
function setupFormValidation() {
    const form = document.getElementById('student-management-form');
    if (!form) return;

    // Pre-populate form if edit query parameters exist
    const params = new URLSearchParams(window.location.search);
    if (params.has('edit_id')) {
        document.getElementById('student_id').value = params.get('edit_id');
        document.getElementById('student_name').value = params.get('edit_name');
        document.getElementById('s1').value = params.get('s1');
        document.getElementById('s2').value = params.get('s2');
        document.getElementById('s3').value = params.get('s3');
        document.getElementById('s4').value = params.get('s4');
        document.getElementById('s5').value = params.get('s5');
        
        // Focus name input
        document.getElementById('student_name').focus();
        showToast('Student details loaded into editor.', 'success');
    }

    const markInputs = form.querySelectorAll('input[type="number"]');
    
    // Add real-time visual helpers
    markInputs.forEach(input => {
        if (input.id === 'student_id') return; // Skip validation for student ID

        input.addEventListener('input', () => {
            const val = parseFloat(input.value);
            if (isNaN(val) || val < 0 || val > 100) {
                input.style.borderColor = 'var(--danger)';
                input.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.2)';
            } else {
                input.style.borderColor = 'var(--success)';
                input.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.2)';
            }
        });
    });

    form.addEventListener('submit', (e) => {
        let valid = true;
        let errMsg = '';

        markInputs.forEach(input => {
            if (input.id === 'student_id') {
                const idVal = parseInt(input.value);
                if (isNaN(idVal) || idVal <= 0) {
                    valid = false;
                    errMsg = 'Student ID must be a positive number.';
                    input.style.borderColor = 'var(--danger)';
                }
                return;
            }

            const val = parseFloat(input.value);
            if (isNaN(val) || val < 0 || val > 100) {
                valid = false;
                errMsg = 'All subject marks must be between 0 and 100.';
                input.style.borderColor = 'var(--danger)';
            }
        });

        if (!valid) {
            e.preventDefault();
            showToast(errMsg, 'danger');
        }
    });
}

// Live Search & Tier Filtering on Records Page
function setupTableSearch() {
    const searchInput = document.getElementById('table-search');
    const tableBody = document.querySelector('table tbody');
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    if (!tableBody) return;
    
    const rows = Array.from(tableBody.querySelectorAll('tr')).slice(1); // skip headers
    if (rows.length === 0) return;

    // Search input typing
    if (searchInput) {
        searchInput.addEventListener('input', filterRows);
    }

    // Filter by grade badges
    let activeGradeFilter = 'all';
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active-filter'));
            btn.classList.add('active-filter');
            activeGradeFilter = btn.dataset.grade;
            filterRows();
        });
    });

    function filterRows() {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) return;
            
            const id = cells[0].textContent.toLowerCase();
            const name = cells[1].textContent.toLowerCase();
            
            // Grade tier cell extraction
            const gradeBadge = row.querySelector('.grade-badge');
            const grade = gradeBadge ? gradeBadge.textContent.trim().toLowerCase() : '';
            
            const matchesQuery = id.includes(query) || name.includes(query);
            const matchesGrade = activeGradeFilter === 'all' || grade === activeGradeFilter;
            
            if (matchesQuery && matchesGrade) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
}

// Dashboard Chart.js Integration
async function initDashboardCharts() {
    const barChartEl = document.getElementById('subjectAverageChart');
    const doughnutChartEl = document.getElementById('gradeDistributionChart');
    if (!barChartEl && !doughnutChartEl) return;

    try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        // Update dashboard KPI cards with data
        updateDashboardKPIs(data);

        const activeTheme = document.documentElement.getAttribute('data-theme');
        const isLight = activeTheme === 'light';
        const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
        const textLabelColor = isLight ? '#475569' : '#9ca3af';

        // 1. Subject Average Bar Chart
        if (barChartEl) {
            const ctx = barChartEl.getContext('2d');
            const subjects = Object.keys(data.subject_averages);
            const averages = Object.values(data.subject_averages);

            window.classAverageChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: subjects,
                    datasets: [{
                        label: 'Average Score',
                        data: averages,
                        backgroundColor: 'rgba(99, 102, 241, 0.65)',
                        borderColor: 'rgb(99, 102, 241)',
                        borderWidth: 1.5,
                        borderRadius: 6,
                        hoverBackgroundColor: 'rgba(99, 102, 241, 0.85)',
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            grid: { color: gridColor },
                            ticks: { color: textLabelColor }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: textLabelColor }
                        }
                    }
                }
            });
        }

        // 2. Grade Distribution Doughnut Chart
        if (doughnutChartEl) {
            const ctx = doughnutChartEl.getContext('2d');
            const grades = Object.keys(data.grade_distribution);
            const counts = Object.values(data.grade_distribution);
            
            // Check if there are any students
            const hasData = counts.some(c => c > 0);

            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: hasData ? grades : ['No Data'],
                    datasets: [{
                        data: hasData ? counts : [1],
                        backgroundColor: hasData ? [
                            'rgba(16, 185, 129, 0.7)', // A
                            'rgba(99, 102, 241, 0.7)', // B
                            'rgba(245, 158, 11, 0.7)', // C
                            'rgba(239, 68, 68, 0.6)',  // D
                            'rgba(239, 68, 68, 0.85)'  // F
                        ] : ['rgba(156, 163, 175, 0.2)'],
                        borderWidth: 1.5,
                        borderColor: isLight ? '#fff' : '#111827'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: textLabelColor,
                                boxWidth: 12,
                                font: { size: 11 }
                            }
                        }
                    },
                    cutout: '65%'
                }
            });
        }

    } catch (e) {
        console.error("Error drawing charts:", e);
    }
}

function updateDashboardKPIs(data) {
    const totalEl = document.getElementById('kpi-total-students');
    const classAvgEl = document.getElementById('kpi-class-average');
    const topStudentEl = document.getElementById('kpi-top-student');
    
    if (totalEl) totalEl.textContent = data.total_students;
    if (classAvgEl) classAvgEl.textContent = data.total_students > 0 ? `${data.class_average}%` : 'N/A';
    if (topStudentEl) {
        topStudentEl.textContent = data.top_student ? data.top_student.name : 'N/A';
        const subEl = topStudentEl.nextElementSibling;
        if (subEl && data.top_student) {
            subEl.textContent = `Average: ${data.top_student.average}% (ID: ${data.top_student.id})`;
        }
    }
}

// Toast System
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '⚡';
    if (type === 'success') icon = '✅';
    if (type === 'danger') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;
    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 4000);
}

// Export CSV utility function for view.html
function exportToCSV() {
    const table = document.querySelector("table");
    if (!table) return;
    
    let csv = [];
    const rows = table.querySelectorAll("tr");
    
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll("td, th");
        
        for (let j = 0; j < cols.length; j++) {
            // Trim whitespace and remove commas/newlines to prevent CSV breaking
            let cleanText = cols[j].textContent.replace(/(\r\n|\n|\r)/gm, "").trim();
            cleanText = cleanText.replace(/"/g, '""'); // Escape double quotes
            row.push('"' + cleanText + '"');
        }
        
        csv.push(row.join(","));
    }
    
    const csvContent = "data:text/csv;charset=utf-8," + csv.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Student_Records_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
window.exportToCSV = exportToCSV;
