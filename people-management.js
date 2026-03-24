// ===== PEOPLE MANAGEMENT WITH MULTIPLE ROLES =====
console.log('People Management script loaded');

// Initialize empty students array
let students = [];

// Load students from Supabase - filtered by current show
async function loadStudentsFromSupabase() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        
        const currentShowId = localStorage.getItem('currentShowId');
        if (!currentShowId) return [];
        
        const { data, error } = await supabase
            .from('students')
            .select('*')
            .eq('user_id', user.id)
            .eq('show_id', currentShowId)  // ← ADD THIS LINE
            .order('name');
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error loading students:', error);
        return [];
    }
}

// Save student to Supabase - include current show_id
async function saveStudentToSupabase(studentData) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Not authenticated' };
        
        const currentShowId = localStorage.getItem('currentShowId');
        
        const supabaseStudent = {
            name: studentData.name,
            grade: studentData.grade,
            roles: studentData.roles,
            vocal_parts: studentData.vocalParts || [],
            crew_specialties: studentData.crewSpecialties || [],
            notes: studentData.notes || '',
            user_id: user.id,
            show_id: currentShowId  // ← ADD THIS LINE
        };
        
        
        let result;
        
        // If student has a valid id (not starting with temp_), update existing record
        if (studentData.id && !studentData.id.toString().startsWith('temp_')) {
            result = await supabase
                .from('students')
                .update(supabaseStudent)
                .eq('id', studentData.id)
                .eq('user_id', user.id)
                .select();
        } else {
            // Create new record
            result = await supabase
                .from('students')
                .insert([supabaseStudent])
                .select();
        }
        
        if (result.error) throw result.error;
        
        return { success: true, data: result.data?.[0] };
    } catch (error) {
        console.error('Error saving student:', error);
        return { success: false, error: error.message };
    }
}

// Delete student from Supabase
async function deleteStudentFromSupabase(studentId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }
        
        const { error } = await supabase
            .from('students')
            .delete()
            .eq('id', studentId)
            .eq('user_id', user.id);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error deleting student:', error);
        return { success: false, error: error.message };
    }
}

/*
try {
    const savedStudents = localStorage.getItem('theatreStudents');
    if (savedStudents) {
        students = JSON.parse(savedStudents);
        console.log('Loaded students from localStorage:', students.length);
    } else {
        console.log('No students found in localStorage');
        students = [];
    }
} catch (e) {
    console.error('Error loading students:', e);
    students = [];
}
*/

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing people management');
    initializePeopleManagement();
});

function initializePeopleManagement() {
    console.log('Initializing people management functions');
    
    // DOM Elements for People Management
    const studentsGrid = document.getElementById('studentsGrid');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchStudent');
    const roleFilter = document.getElementById('roleFilter');
    const gradeFilter = document.getElementById('gradeFilter');
    const vocalFilter = document.getElementById('vocalFilter');
    const studentModal = document.getElementById('studentModal');
    const openModalBtn = document.getElementById('openAddStudentModal');
    const closeModalBtn = document.getElementById('closeModal');
    const cancelModalBtn = document.getElementById('cancelModal');
    const emptyStateAddBtn = document.getElementById('emptyStateAddBtn');
    const studentForm = document.getElementById('studentForm');
    const modalTitle = document.getElementById('modalTitleText');
    const submitButtonText = document.getElementById('submitButtonText');
    const studentId = document.getElementById('studentId');

    console.log('DOM Elements found:', {
        studentsGrid: !!studentsGrid,
        emptyState: !!emptyState,
        searchInput: !!searchInput,
        roleFilter: !!roleFilter,
        studentModal: !!studentModal
    });

    // Checkbox elements
    const roleMain = document.getElementById('roleMain');
    const roleEnsemble = document.getElementById('roleEnsemble');
    const roleCrew = document.getElementById('roleCrew');
    const vocalSoprano = document.getElementById('vocalSoprano');
    const vocalAlto = document.getElementById('vocalAlto');
    const vocalTenor = document.getElementById('vocalTenor');
    const vocalBass = document.getElementById('vocalBass');
    const crewLights = document.getElementById('crewLights');
    const crewSound = document.getElementById('crewSound');
    const crewCurtains = document.getElementById('crewCurtains');
    const crewSet = document.getElementById('crewSet');
    const crewCostumes = document.getElementById('crewCostumes');
    const crewProps = document.getElementById('crewProps');

    // Sections
    const vocalPartsSection = document.getElementById('vocalPartsSection');
    const crewSpecialtiesSection = document.getElementById('crewSpecialtiesSection');
    const roleError = document.getElementById('roleError');

    if (!studentsGrid) {
        console.log('Students grid not found - not on people page');
        return; // Exit if not on a page with people section
    }

    async function loadInitialStudents() {
        students = await loadStudentsFromSupabase();
        renderStudents();
        updatePeopleStats();
    }
    
    loadInitialStudents();

    // Show/hide sections based on role selections
    function updateSections() {
        console.log('Updating sections based on role selection');
        if (!roleMain || !roleEnsemble || !roleCrew) return;
        
        const hasMainOrEnsemble = roleMain.checked || roleEnsemble.checked;
        const hasCrew = roleCrew.checked;
        
        console.log('Role selections:', { hasMainOrEnsemble, hasCrew });
        
        if (hasMainOrEnsemble && vocalPartsSection) {
            vocalPartsSection.classList.remove('hidden');
        } else if (vocalPartsSection) {
            vocalPartsSection.classList.add('hidden');
            [vocalSoprano, vocalAlto, vocalTenor, vocalBass].forEach(cb => {
                if (cb) cb.checked = false;
            });
        }
        
        if (hasCrew && crewSpecialtiesSection) {
            crewSpecialtiesSection.classList.remove('hidden');
        } else if (crewSpecialtiesSection) {
            crewSpecialtiesSection.classList.add('hidden');
            [crewLights, crewSound, crewCurtains, crewSet, crewCostumes, crewProps].forEach(cb => {
                if (cb) cb.checked = false;
            });
        }
    }

    // Render students with filters
    function renderStudents() {
        console.log('Rendering students. Total students:', students.length);
        if (!studentsGrid) return;
        
        const searchTerm = searchInput?.value.toLowerCase() || '';
        const roleValue = roleFilter?.value || 'all';
        const gradeValue = gradeFilter?.value || 'all';
        const vocalValue = vocalFilter?.value || 'all';
        
        console.log('Filter values:', { searchTerm, roleValue, gradeValue, vocalValue });
        
        const filteredStudents = students.filter(student => {
            const matchesSearch = student.name.toLowerCase().includes(searchTerm);
            const matchesGrade = gradeValue === 'all' || student.grade === gradeValue;
            const matchesRole = roleValue === 'all' || (student.roles && student.roles.includes(roleValue));
            const matchesVocal = vocalValue === 'all' || 
                                (student.vocal_parts && student.vocal_parts.includes(vocalValue));
            
            return matchesSearch && matchesGrade && matchesRole && matchesVocal;
        });
        
        console.log('Filtered students count:', filteredStudents.length);
        
        if (filteredStudents.length === 0) {
            studentsGrid.innerHTML = '';
            if (emptyState) {
                emptyState.classList.remove('hidden');
                studentsGrid.classList.add('hidden');
            }
            return;
        }
        
        if (emptyState) emptyState.classList.add('hidden');
        if (studentsGrid) studentsGrid.classList.remove('hidden');
        
        // Log the first student to check its structure
        if (filteredStudents.length > 0) {
            console.log('Sample student data:', filteredStudents[0]);
            console.log('Sample student roles:', filteredStudents[0].roles);
        }
        
        studentsGrid.innerHTML = filteredStudents.map(student => {
            // Generate role badges
            const roleBadges = (student.roles || []).map(role => {
                const roleColors = {
                    main: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
                    ensemble: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
                    crew: 'bg-blue-600/20 text-blue-400 border-blue-600/30'
                };
                
                const roleLabels = {
                    main: 'Main Cast',
                    ensemble: 'Ensemble',
                    crew: 'Crew'
                };
                
                return `<span class="px-2 py-1 rounded-full text-xs font-medium border ${roleColors[role]}">${roleLabels[role]}</span>`;
            }).join(' ');
            
            // Generate vocal part badges
            const vocalBadges = (student.vocal_parts || []).map(part => {
                const vocalLabels = {
                    soprano: 'Soprano',
                    alto: 'Alto',
                    tenor: 'Tenor',
                    bass: 'Bass',
                    mezzo: 'Mezzo',
                    baritone: 'Baritone'
                };
                
                return `<span class="inline-flex items-center gap-1 text-xs text-amber-200/80 bg-amber-600/10 px-2 py-1 rounded-full">
                    <i class="fas fa-music text-amber-400/60 text-xs"></i>
                    ${vocalLabels[part] || part}
                </span>`;
            }).join(' ');
            
            // Generate crew specialty badges
            const crewBadges = (student.crew_specialties || []).map(specialty => {
                const specialtyLabels = {
                    lights: 'Lights',
                    sound: 'Sound',
                    curtains: 'Curtains',
                    set: 'Set',
                    costumes: 'Costumes',
                    props: 'Props'
                };
                
                return `<span class="inline-flex items-center gap-1 text-xs text-blue-200/80 bg-blue-600/10 px-2 py-1 rounded-full">
                    <i class="fas fa-tools text-blue-400/60 text-xs"></i>
                    ${specialtyLabels[specialty] || specialty}
                </span>`;
            }).join(' ');
            
            return `
                <div class="student-card bg-amber-600/5 rounded-xl p-4 border border-amber-600/20 hover:border-amber-600/40 transition-all group">
                    <div class="flex items-start justify-between mb-3">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white font-semibold">
                            ${student.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                        </div>
                        <div class="flex gap-1">
                            <button onclick="window.editStudent(${student.id})" class="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 flex items-center justify-center">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="window.deleteStudent(${student.id})" class="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 flex items-center justify-center">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    
                    <h3 class="font-display font-semibold text-amber-100 mb-2">${student.name}</h3>
                    
                    <div class="space-y-3">
                        <div class="flex items-center gap-2 text-sm">
                            <span class="text-amber-200/50 w-16">Grade:</span>
                            <span class="text-amber-200/80 font-medium">${student.grade}th</span>
                        </div>
                        
                        <div class="border-t border-amber-600/20 pt-2">
                            <div class="text-xs text-amber-200/50 uppercase tracking-wider mb-2">Roles</div>
                            <div class="flex flex-wrap gap-1">
                                ${roleBadges || '<span class="text-xs text-amber-200/50">No roles assigned</span>'}
                            </div>
                        </div>
                        
                        ${student.vocal_parts && student.vocal_parts.length > 0 ? `
                            <div class="border-t border-amber-600/20 pt-2">
                                <div class="text-xs text-amber-200/50 uppercase tracking-wider mb-2">Vocal Parts</div>
                                <div class="flex flex-wrap gap-1">
                                    ${vocalBadges}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${student.crew_specialties && student.crew_specialties.length > 0 ? `
                            <div class="border-t border-amber-600/20 pt-2">
                                <div class="text-xs text-amber-200/50 uppercase tracking-wider mb-2">Crew Specialties</div>
                                <div class="flex flex-wrap gap-1">
                                    ${crewBadges}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${student.notes ? `
                            <div class="border-t border-amber-600/20 pt-2">
                                <div class="text-xs text-amber-200/50 uppercase tracking-wider mb-2">Notes</div>
                                <div class="text-xs text-amber-200/70 italic bg-amber-950/30 p-2 rounded-lg">
                                    "${student.notes}"
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('Students rendered successfully');
    }

    // Update statistics
    function updatePeopleStats() {
        const totalStudents = students.length;
        const mainCount = students.filter(s => s.roles && s.roles.includes('main')).length;
        const ensembleCount = students.filter(s => s.roles && s.roles.includes('ensemble')).length;
        const crewCount = students.filter(s => s.roles && s.roles.includes('crew')).length;
        const vocalCount = students.filter(s => s.vocal_parts && s.vocal_parts.length > 0).length;
        
        console.log('Stats updated:', { totalStudents, mainCount, ensembleCount, crewCount, vocalCount });
        
        const totalEl = document.getElementById('totalStudents');
        const mainEl = document.getElementById('mainCount');
        const ensembleEl = document.getElementById('ensembleCount');
        const crewEl = document.getElementById('crewCount');
        const vocalEl = document.getElementById('vocalCount');
        
        if (totalEl) totalEl.textContent = totalStudents;
        if (mainEl) mainEl.textContent = mainCount;
        if (ensembleEl) ensembleEl.textContent = ensembleCount;
        if (crewEl) crewEl.textContent = crewCount;
        if (vocalEl) vocalEl.textContent = vocalCount;
    }

    // Reset form for new student
    function resetForm() {
        console.log('Resetting form');
        if (!studentForm) return;
        
        studentForm.reset();
        if (studentId) studentId.value = '';
        if (modalTitle) modalTitle.textContent = 'Add New Student';
        if (submitButtonText) submitButtonText.textContent = 'Add Student';
        if (vocalPartsSection) vocalPartsSection.classList.add('hidden');
        if (crewSpecialtiesSection) crewSpecialtiesSection.classList.add('hidden');
        if (roleError) roleError.classList.add('hidden');
        
        [roleMain, roleEnsemble, roleCrew, 
         vocalSoprano, vocalAlto, vocalTenor, vocalBass,
         crewLights, crewSound, crewCurtains, crewSet, crewCostumes, crewProps].forEach(cb => {
            if (cb) cb.checked = false;
        });
    }

    // Edit student
    window.editStudent = function(id) {
        console.log('Editing student with id:', id);
        const student = students.find(s => s.id === id);
        if (!student) {
            console.log('Student not found');
            return;
        }
        
        console.log('Student data for edit:', student);
        resetForm();
        
        if (studentId) studentId.value = student.id;
        const nameInput = document.getElementById('studentName');
        const gradeInput = document.getElementById('studentGrade');
        const notesInput = document.getElementById('studentNotes');
        
        if (nameInput) nameInput.value = student.name;
        if (gradeInput) gradeInput.value = student.grade;
        if (notesInput) notesInput.value = student.notes || '';
        
        if (student.roles) {
            if (roleMain) roleMain.checked = student.roles.includes('main');
            if (roleEnsemble) roleEnsemble.checked = student.roles.includes('ensemble');
            if (roleCrew) roleCrew.checked = student.roles.includes('crew');
        }
        
        if (student.vocal_parts) {
            if (vocalSoprano) vocalSoprano.checked = student.vocal_parts.includes('soprano');
            if (vocalAlto) vocalAlto.checked = student.vocal_parts.includes('alto');
            if (vocalTenor) vocalTenor.checked = student.vocal_parts.includes('tenor');
            if (vocalBass) vocalBass.checked = student.vocal_parts.includes('bass');
        }
        
        if (student.crew_specialties) {
            if (crewLights) crewLights.checked = student.crew_specialties.includes('lights');
            if (crewSound) crewSound.checked = student.crew_specialties.includes('sound');
            if (crewCurtains) crewCurtains.checked = student.crew_specialties.includes('curtains');
            if (crewSet) crewSet.checked = student.crew_specialties.includes('set');
            if (crewCostumes) crewCostumes.checked = student.crew_specialties.includes('costumes');
            if (crewProps) crewProps.checked = student.crew_specialties.includes('props');
        }
        
        updateSections();
        
        if (modalTitle) modalTitle.textContent = 'Edit Student';
        if (submitButtonText) submitButtonText.textContent = 'Save Changes';
        
        openModal();
    };

    // Delete student
    window.deleteStudent = async function(id) {
        if (!confirm('Are you sure you want to delete this student?')) return;
        
        console.log('Deleting student with id:', id);
        
        const result = await deleteStudentFromSupabase(id);
        
        if (result.success) {
            // Remove from local array
            students = students.filter(s => s.id !== id);
            renderStudents();
            updatePeopleStats();
            console.log('Student deleted successfully');
        } else {
            alert('Error deleting student: ' + result.error);
        }
    };

    // Save student (add or update)
    async function saveStudent(e) {
        e.preventDefault();
        console.log('Saving student form');
        
        const nameInput = document.getElementById('studentName');
        const gradeInput = document.getElementById('studentGrade');
        const notesInput = document.getElementById('studentNotes');
        
        const name = nameInput ? nameInput.value : '';
        const grade = gradeInput ? gradeInput.value : '';
        const notes = notesInput ? notesInput.value : '';
        const id = studentId && studentId.value ? parseInt(studentId.value) : 'temp_' + Date.now();
        
        const roles = [];
        if (roleMain && roleMain.checked) roles.push('main');
        if (roleEnsemble && roleEnsemble.checked) roles.push('ensemble');
        if (roleCrew && roleCrew.checked) roles.push('crew');
        
        if (roles.length === 0) {
            console.log('No roles selected');
            if (roleError) roleError.classList.remove('hidden');
            return;
        }
        if (roleError) roleError.classList.add('hidden');
        
        const vocalParts = [];
        if (vocalSoprano && vocalSoprano.checked) vocalParts.push('soprano');
        if (vocalAlto && vocalAlto.checked) vocalParts.push('alto');
        if (vocalTenor && vocalTenor.checked) vocalParts.push('tenor');
        if (vocalBass && vocalBass.checked) vocalParts.push('bass');
        
        const crewSpecialties = [];
        if (crewLights && crewLights.checked) crewSpecialties.push('lights');
        if (crewSound && crewSound.checked) crewSpecialties.push('sound');
        if (crewCurtains && crewCurtains.checked) crewSpecialties.push('curtains');
        if (crewSet && crewSet.checked) crewSpecialties.push('set');
        if (crewCostumes && crewCostumes.checked) crewSpecialties.push('costumes');
        if (crewProps && crewProps.checked) crewSpecialties.push('props');
        
        const studentData = {
            id,
            name,
            grade,
            roles,
            vocalParts,
            crewSpecialties,
            notes
        };
        
        console.log('Saving student data:', studentData);
        
        // Save to Supabase
        const result = await saveStudentToSupabase(studentData);
        
        if (result.success) {
            console.log('Saved to Supabase successfully');
            
            // Refresh students list
            students = await loadStudentsFromSupabase();
            
            resetForm();
            closeModal();
            
            renderStudents();
            updatePeopleStats();
        } else {
            alert('Error saving student: ' + result.error);
        }
    }

    // Modal functions
    function openModal() {
        console.log('Opening modal');
        if (studentModal) {
            studentModal.classList.remove('hidden');
            studentModal.classList.add('flex');
        }
    }

    function closeModal() {
        console.log('Closing modal');
        if (studentModal) {
            studentModal.classList.add('hidden');
            studentModal.classList.remove('flex');
            resetForm();
        }
    }

    // Setup event listeners for people management
    function setupPeopleEventListeners() {
        console.log('Setting up event listeners');
        
        if (searchInput) searchInput.addEventListener('input', renderStudents);
        if (roleFilter) roleFilter.addEventListener('change', renderStudents);
        if (gradeFilter) gradeFilter.addEventListener('change', renderStudents);
        if (vocalFilter) vocalFilter.addEventListener('change', renderStudents);
        
        if (openModalBtn) {
            openModalBtn.addEventListener('click', () => {
                resetForm();
                openModal();
            });
        }
        
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
        if (emptyStateAddBtn) {
            emptyStateAddBtn.addEventListener('click', () => {
                resetForm();
                openModal();
            });
        }
        
        if (studentForm) studentForm.addEventListener('submit', saveStudent);
        
        if (studentModal) {
            studentModal.addEventListener('click', function(e) {
                if (e.target === studentModal) {
                    closeModal();
                }
            });
        }
        
        if (roleMain && roleEnsemble && roleCrew) {
            [roleMain, roleEnsemble, roleCrew].forEach(cb => {
                if (cb) cb.addEventListener('change', updateSections);
            });
        }
    }

    // Initialize
    console.log('Calling render functions');
    // renderStudents() and updatePeopleStats() are now called after loading from Supabase
    setupPeopleEventListeners();
    
    console.log('People management initialization complete');
}

async function initializePageWithUser() {
    // Check if user is staff
    const isStaff = await auth?.isStaff?.() ?? false;
    if (isStaff) {
        document.getElementById('staffOnlyControls')?.classList.remove('hidden');
    }
    
    // Show user info on cards (optional)
    const user = await auth?.getUser?.();
    if (user) {
        document.body.setAttribute('data-user-id', user.id);
    }
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', initializePageWithUser);