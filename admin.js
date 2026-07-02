import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, deleteDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('admin-form');
    const msgBox = document.getElementById('admin-message');
    const tableBody = document.getElementById('admin-table-body');

    // Login Elements
    const loginOverlay = document.getElementById('login-overlay');
    const adminWrapper = document.getElementById('admin-wrapper');
    const loginForm = document.getElementById('login-form');
    const pinInput = document.getElementById('admin-pin');
    const loginMsg = document.getElementById('login-message');

    // Tabs Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            const targetEl = document.getElementById(target);
            if(targetEl) targetEl.classList.add('active');
            
            const manageTab = document.getElementById('manage-tab');
            if(manageTab) {
                if (target === 'dashboard-tab') {
                    manageTab.classList.add('active');
                } else {
                    manageTab.classList.remove('active');
                }
            }
        });
    });

    // Upload Type Logic
    const groupVideoUrl = document.getElementById('group-video-url');
    const groupCollectionUrls = document.getElementById('group-collection-urls');

    document.getElementsByName('upload-type').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'collection') {
                groupVideoUrl.style.display = 'none';
                groupCollectionUrls.style.display = 'flex';
                document.getElementById('video-url').required = false;
            } else {
                groupVideoUrl.style.display = 'flex';
                groupCollectionUrls.style.display = 'none';
                document.getElementById('video-url').required = true;
            }
        });
    });

    let videos = [];
    let stories = [];
    let siteVisits = 0;
    let editingVideoId = null;
    let editingStoryId = null;

    // Authentication Check
    if (sessionStorage.getItem('admin_auth') === 'true') {
        showAdminPanel();
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (pinInput.value.trim() === '0118') {
            sessionStorage.setItem('admin_auth', 'true');
            showAdminPanel();
        } else {
            loginMsg.textContent = 'Incorrect PIN. Try again.';
            loginMsg.className = 'admin-message error';
            loginMsg.classList.remove('hidden');
            pinInput.value = '';
            setTimeout(() => loginMsg.classList.add('hidden'), 3000);
        }
    });

    function showAdminPanel() {
        loginOverlay.style.display = 'none';
        adminWrapper.style.display = 'block';
        loadData();
    }

    async function loadData() {
        try {
            // Load site visits
            const statsRef = doc(db, 'stats', 'global');
            const statsSnap = await getDoc(statsRef);
            if (statsSnap.exists()) {
                siteVisits = statsSnap.data().totalVisits || 0;
            }

            // Load videos
            const querySnapshot = await getDocs(collection(db, "videos"));
            videos = [];
            querySnapshot.forEach((doc) => {
                videos.push({ id: doc.id, ...doc.data() });
            });

            // Load stories
            const storiesSnapshot = await getDocs(collection(db, "stories"));
            stories = [];
            storiesSnapshot.forEach((doc) => {
                stories.push({ id: doc.id, ...doc.data() });
            });

            renderTable();
            renderStoryTable();
        } catch (error) {
            console.error("Error loading data from Firebase", error);
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">
                <strong>Firebase Error:</strong> ${error.message}<br>
                <small>Please ensure you have created a Firestore Database in your Firebase Console and set the security rules to Test Mode.</small>
            </td></tr>`;
        }
    }

    function updateDashboard() {
        const statVisits = document.getElementById('stat-visits');
        const statViews = document.getElementById('stat-views');
        const statVideos = document.getElementById('stat-videos');

        if (statVisits) statVisits.textContent = siteVisits.toLocaleString();
        
        let totalViews = 0;
        videos.forEach(v => { totalViews += (v.views || 0); });
        
        if (statViews) statViews.textContent = totalViews.toLocaleString();
        if (statVideos) statVideos.textContent = videos.length.toLocaleString();
    }

    // Render Table
    function renderTable() {
        tableBody.innerHTML = '';
        updateDashboard();

        if (videos.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No videos uploaded yet.</td></tr>';
            return;
        }

        videos.forEach(video => {
            const tr = document.createElement('tr');
            const dateStr = video.dateAdded ? new Date(video.dateAdded).toLocaleDateString() : 'Unknown';
            let titlePrefix = video.type === 'collection' ? '<span style="background:var(--primary); color:#000; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight:bold; margin-right:5px;">COLLECTION</span>' : '';

            tr.innerHTML = `
                <td><img src="${video.thumbnail}" class="thumb-preview" alt="Thumb" onerror="this.src='https://via.placeholder.com/80x45.png?text=No+Thumb'"></td>
                <td><strong>${titlePrefix}${video.title}</strong><br><small><i class="fa-solid fa-eye"></i> ${video.views || 0} views</small></td>
                <td>${dateStr}</td>
                <td>
                    <button class="btn-edit" data-id="${video.id}"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="btn-delete" data-id="${video.id}"><i class="fa-solid fa-trash"></i> Delete</button>
                </td>
            `;

            tr.querySelector('.btn-delete').addEventListener('click', (e) => {
                const id = e.target.closest('.btn-delete').getAttribute('data-id');
                deleteVideo(id);
            });

            tr.querySelector('.btn-edit').addEventListener('click', (e) => {
                const id = e.target.closest('.btn-edit').getAttribute('data-id');
                editVideo(id);
            });

            tableBody.appendChild(tr);
        });
    }

    async function deleteVideo(id) {
        if (confirm('Are you sure you want to delete this video?')) {
            try {
                await deleteDoc(doc(db, "videos", id));
                showMessage('Video deleted successfully.', 'success');
                loadData(); // reload table
            } catch (error) {
                console.error("Error deleting document: ", error);
                showMessage('Failed to delete video.', 'error');
            }
        }
    }

    function editVideo(id) {
        const video = videos.find(v => v.id === id);
        if (!video) return;

        editingVideoId = id;
        
        const isCollection = video.type === 'collection';
        const typeRadio = document.querySelector(`input[name="upload-type"][value="${isCollection ? 'collection' : 'single'}"]`);
        if(typeRadio) {
            typeRadio.checked = true;
            typeRadio.dispatchEvent(new Event('change'));
        }

        if (isCollection) {
            const urls = (video.streamtapeIds || []).map(vid => `https://streamtape.com/v/${vid}/`).join('\n');
            document.getElementById('collection-urls').value = urls;
            document.getElementById('video-url').value = '';
        } else {
            document.getElementById('video-url').value = `https://streamtape.com/v/${video.streamtapeId}/`;
            document.getElementById('collection-urls').value = '';
        }

        document.getElementById('video-title').value = video.title || '';
        document.getElementById('video-thumbnail').value = video.thumbnail || '';
        document.getElementById('video-desc').value = video.description || '';

        document.getElementById('form-title').innerHTML = '<i class="fa-solid fa-pen"></i> Edit Video';
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.innerHTML = 'Update Video';
        document.getElementById('cancel-edit-btn').style.display = 'block';

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.getElementById('cancel-edit-btn').addEventListener('click', () => {
        editingVideoId = null;
        form.reset();
        document.getElementById('form-title').innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload New Video';
        document.getElementById('submit-btn').innerHTML = 'Add Video';
        document.getElementById('cancel-edit-btn').style.display = 'none';
    });

    // --- STORY MANAGEMENT ---
    function renderStoryTable() {
        const storyTableBody = document.getElementById('admin-story-table-body');
        if (!storyTableBody) return;
        storyTableBody.innerHTML = '';

        if (stories.length === 0) {
            storyTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No stories uploaded yet.</td></tr>';
            return;
        }

        stories.forEach(story => {
            const tr = document.createElement('tr');
            const dateStr = story.dateAdded ? new Date(story.dateAdded).toLocaleDateString() : 'Unknown';

            tr.innerHTML = `
                <td><img src="${story.thumbnail}" class="thumb-preview" alt="Thumb" onerror="this.src='https://via.placeholder.com/80x45.png?text=No+Thumb'"></td>
                <td><strong>${story.title}</strong><br><small><i class="fa-solid fa-eye"></i> ${story.views || 0} views</small></td>
                <td>${dateStr}</td>
                <td>
                    <button class="btn-edit" data-id="${story.id}"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="btn-delete" data-id="${story.id}"><i class="fa-solid fa-trash"></i> Delete</button>
                </td>
            `;

            tr.querySelector('.btn-delete').addEventListener('click', (e) => {
                const id = e.target.closest('.btn-delete').getAttribute('data-id');
                deleteStory(id);
            });

            tr.querySelector('.btn-edit').addEventListener('click', (e) => {
                const id = e.target.closest('.btn-edit').getAttribute('data-id');
                editStory(id);
            });

            storyTableBody.appendChild(tr);
        });
    }

    async function deleteStory(id) {
        if (confirm('Are you sure you want to delete this story?')) {
            try {
                await deleteDoc(doc(db, "stories", id));
                showMessage('Story deleted successfully.', 'success');
                loadData(); // reload tables
            } catch (error) {
                console.error("Error deleting story: ", error);
                showMessage('Failed to delete story.', 'error');
            }
        }
    }

    function editStory(id) {
        const story = stories.find(s => s.id === id);
        if (!story) return;

        editingStoryId = id;
        document.getElementById('story-title').value = story.title || '';
        document.getElementById('story-thumbnail').value = story.thumbnail || '';
        document.getElementById('story-content').value = story.content || '';

        // Switch to the Upload Story tab
        const uploadStoryTabBtn = document.querySelector('.tab-btn[data-tab="upload-story-tab"]');
        if (uploadStoryTabBtn) uploadStoryTabBtn.click();

        document.querySelector('#upload-story-tab h2').innerHTML = '<i class="fa-solid fa-pen"></i> Edit Story';
        const submitBtn = document.getElementById('story-submit-btn');
        submitBtn.innerHTML = 'Update Story';
        const cancelBtn = document.getElementById('cancel-story-edit-btn');
        if (cancelBtn) cancelBtn.style.display = 'block';

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const cancelStoryEditBtn = document.getElementById('cancel-story-edit-btn');
    if (cancelStoryEditBtn) {
        cancelStoryEditBtn.addEventListener('click', () => {
            editingStoryId = null;
            document.getElementById('story-form').reset();
            document.querySelector('#upload-story-tab h2').innerHTML = '<i class="fa-solid fa-book-open"></i> Upload New Story';
            document.getElementById('story-submit-btn').innerHTML = 'Publish Story';
            cancelStoryEditBtn.style.display = 'none';
        });
    }
    // --- END STORY MANAGEMENT ---

    function showMessage(msg, type, autoHide = true) {
        msgBox.innerHTML = msg; // Changed to innerHTML to support icons
        msgBox.className = `admin-message ${type}`;
        if (autoHide) {
            setTimeout(() => {
                msgBox.className = 'admin-message hidden';
            }, 3000);
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = editingVideoId ? 'Update Video' : 'Add Video';

        const uploadType = document.querySelector('input[name="upload-type"]:checked').value;
        const title = document.getElementById('video-title').value.trim();
        const desc = document.getElementById('video-desc').value.trim();
        const customThumbnail = document.getElementById('video-thumbnail') ? document.getElementById('video-thumbnail').value.trim() : '';

        let streamtapeId = '';
        let streamtapeIds = [];

        if (uploadType === 'single') {
            const url = document.getElementById('video-url').value.trim();
            if (!url.includes('streamtape.com/v/') && !url.includes('streamtape.com/e/')) {
                showMessage('Invalid Streamtape URL. It must contain /v/ or /e/', 'error');
                return;
            }
            try {
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/');
                streamtapeId = pathParts[2];
                if (!streamtapeId) throw new Error();
            } catch (err) {
                showMessage('Could not extract Video ID from the link.', 'error');
                return;
            }
        } else {
            const urlsText = document.getElementById('collection-urls').value.trim();
            if (!urlsText) {
                showMessage('Please enter at least one Streamtape URL.', 'error');
                return;
            }
            const lines = urlsText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            for (let url of lines) {
                if (!url.includes('streamtape.com/v/') && !url.includes('streamtape.com/e/')) continue;
                try {
                    const urlObj = new URL(url);
                    const pathParts = urlObj.pathname.split('/');
                    const id = pathParts[2];
                    if (id) streamtapeIds.push(id);
                } catch(e) {}
            }
            if (streamtapeIds.length === 0) {
                showMessage('No valid Streamtape IDs found in the collection list.', 'error');
                return;
            }
            streamtapeId = streamtapeIds[0]; // for thumbnail fetching
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

        let fetchedThumbnail = customThumbnail || 'https://via.placeholder.com/640x360.png?text=No+Thumbnail';
        
        if (!customThumbnail) {
            showMessage('<i class="fa-solid fa-circle-notch fa-spin"></i> Step 1/2: Fetching thumbnail from Streamtape...', 'success', false);
            try {
                // Fetch video info from Streamtape API using a proxy to avoid CORS issues on GitHub Pages
                const apiUrl = `https://api.streamtape.com/file/info?file=${streamtapeId}`;
                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;
                
                const response = await fetch(proxyUrl);
                const proxyData = await response.json();
                const data = JSON.parse(proxyData.contents);
                
                if (data && data.status === 200 && data.result[streamtapeId]) {
                    fetchedThumbnail = data.result[streamtapeId].thumb;
                } else {
                    console.warn("Streamtape API didn't return a thumbnail.");
                }
            } catch (err) {
                console.error("Error fetching thumbnail from Streamtape:", err);
                // Fallback is already set
            }
        }

        showMessage('<i class="fa-solid fa-circle-notch fa-spin"></i> Step 2/2: Saving video to database...', 'success', false);
        const newVideoData = {
            type: uploadType,
            streamtapeId: uploadType === 'single' ? streamtapeId : '',
            streamtapeIds: uploadType === 'collection' ? streamtapeIds : [],
            title: title,
            thumbnail: fetchedThumbnail,
            description: desc,
            views: 0,
            dateAdded: new Date().toISOString()
        };

        try {
            if (editingVideoId) {
                delete newVideoData.views;
                delete newVideoData.dateAdded;
                await updateDoc(doc(db, "videos", editingVideoId), newVideoData);
                showMessage('Video updated successfully! <i class="fa-solid fa-check"></i>', 'success');
                editingVideoId = null;
                document.getElementById('form-title').innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload New Video';
                document.getElementById('cancel-edit-btn').style.display = 'none';
            } else {
                await addDoc(collection(db, "videos"), newVideoData);
                showMessage('Video added successfully! <i class="fa-solid fa-check"></i>', 'success');
            }
            form.reset();
            loadData(); // reload table
        } catch (error) {
            console.error("Error saving document: ", error);
            showMessage('Failed to save video. Check Firebase rules.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = editingVideoId ? 'Update Video' : 'Add Video';
        }
    });

    // Story Upload Logic
    const storyForm = document.getElementById('story-form');
    const storyMsgBox = document.getElementById('story-message');

    if (storyForm) {
        storyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('story-submit-btn');
            const originalBtnText = submitBtn.innerHTML;
            
            const title = document.getElementById('story-title').value.trim();
            const thumbnail = document.getElementById('story-thumbnail').value.trim();
            const content = document.getElementById('story-content').value.trim();
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            
            const newStoryData = {
                title: title,
                thumbnail: thumbnail,
                content: content
            };
            
            try {
                if (editingStoryId) {
                    await updateDoc(doc(db, "stories", editingStoryId), newStoryData);
                    storyMsgBox.innerHTML = 'Story updated successfully! <i class="fa-solid fa-check"></i>';
                    editingStoryId = null;
                    document.querySelector('#upload-story-tab h2').innerHTML = '<i class="fa-solid fa-book-open"></i> Upload New Story';
                    const cancelBtn = document.getElementById('cancel-story-edit-btn');
                    if (cancelBtn) cancelBtn.style.display = 'none';
                } else {
                    newStoryData.views = 0;
                    newStoryData.dateAdded = new Date().toISOString();
                    await addDoc(collection(db, "stories"), newStoryData);
                    storyMsgBox.innerHTML = 'Story published successfully! <i class="fa-solid fa-check"></i>';
                }
                
                storyMsgBox.className = 'admin-message success';
                setTimeout(() => { storyMsgBox.className = 'admin-message hidden'; }, 3000);
                storyForm.reset();
                loadData(); // reload table
            } catch (error) {
                console.error("Error saving story: ", error);
                storyMsgBox.innerHTML = 'Failed to save story. Check Firebase rules.';
                storyMsgBox.className = 'admin-message error';
                setTimeout(() => { storyMsgBox.className = 'admin-message hidden'; }, 3000);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    }

});
