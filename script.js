import { db } from './firebase-config.js';
import { collection, getDocs, doc, updateDoc, increment, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// Global 1-minute click ad interceptor
document.addEventListener('click', (e) => {
    const lastAdClick = localStorage.getItem('global_ad_click_time');
    const now = Date.now();
    
    // 20000 ms = 20 seconds. Check if 20s has passed since the last click.
    if (!lastAdClick || (now - parseInt(lastAdClick)) > 20000) {
        // Stop the normal click action
        e.preventDefault();
        e.stopPropagation();
        
        // Save the new click time
        localStorage.setItem('global_ad_click_time', now.toString());
        
        // Open the ad in a new tab
        window.open('https://omg10.com/4/11219718', '_blank');
    }
}, true); // true = capture phase (catches click before anything else)

document.addEventListener('DOMContentLoaded', async () => {
    let currentPage = 1;
    const videosPerPage = 20;
    let currentVideoList = [];

    const videoGrid = document.getElementById('video-grid');
    const modal = document.getElementById('player-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const videoContainer = document.getElementById('video-container');
    const modalVideoTitle = document.getElementById('modal-video-title');
    const modalVideoDesc = document.getElementById('modal-video-desc');
    const shareBtn = document.getElementById('share-btn');
    
    const paginationContainer = document.getElementById('pagination-container');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    const searchInput = document.querySelector('.search-box input');
    const filterButtons = document.querySelectorAll('.pill-nav a');

    let videos = [];
    let stories = [];
    let currentVideoId = null;

    // Setup or Increment Site Visits
    try {
        const statsRef = doc(db, 'stats', 'global');
        const statsSnap = await getDoc(statsRef);
        if (!statsSnap.exists()) {
            await setDoc(statsRef, { totalVisits: 1 });
        } else {
            await updateDoc(statsRef, { totalVisits: increment(1) });
        }
    } catch (e) {
        console.error("Firebase config is likely missing or incorrect.", e);
    }

    // Load Videos from Firestore
    async function loadVideos() {
        try {
            const querySnapshot = await getDocs(collection(db, "videos"));
            videos = [];
            querySnapshot.forEach((doc) => {
                videos.push({ id: doc.id, ...doc.data() });
            });
            applyFilter('All Videos'); // Default view
            
            // Check for shared video link
            const urlParams = new URLSearchParams(window.location.search);
            const sharedVideoId = urlParams.get('v');
            if (sharedVideoId) {
                const videoToPlay = videos.find(v => v.id === sharedVideoId);
                if (videoToPlay) {
                    playVideo(videoToPlay);
                }
            }
        } catch (error) {
            console.error("Error fetching videos: ", error);
            videoGrid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1; text-align:center; padding: 40px;">Please configure Firebase in firebase-config.js to see videos.</p>';
        }
    }

    // Load Stories from Firestore
    async function loadStories() {
        try {
            const querySnapshot = await getDocs(collection(db, "stories"));
            stories = [];
            querySnapshot.forEach((doc) => {
                stories.push({ id: doc.id, ...doc.data() });
            });
        } catch (error) {
            console.error("Error fetching stories: ", error);
        }
    }

    // Helper: Format numbers (e.g., 1500 -> 1.5K)
    function formatViews(num) {
        if (!num) return 0;
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num;
    }

    function updatePagination() {
        if (!paginationContainer) return;
        const totalPages = Math.ceil(currentVideoList.length / videosPerPage);
        
        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
        } else {
            paginationContainer.style.display = 'flex';
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            prevPageBtn.disabled = currentPage === 1;
            nextPageBtn.disabled = currentPage === totalPages;
        }
    }

    // Render Grid
    function renderVideos(videoList = currentVideoList, page = currentPage) {
        currentVideoList = videoList;
        currentPage = page;
        videoGrid.innerHTML = '';

        if (videoList.length === 0) {
            videoGrid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1; text-align:center; padding: 40px;">No videos found.</p>';
            if (paginationContainer) paginationContainer.style.display = 'none';
            return;
        }

        const startIndex = (currentPage - 1) * videosPerPage;
        const endIndex = startIndex + videosPerPage;
        const videosToRender = videoList.slice(startIndex, endIndex);

        videosToRender.forEach(video => {
            const card = document.createElement('div');
            card.className = 'video-card';
            
            const dateStr = video.dateAdded ? new Date(video.dateAdded).toLocaleDateString() : 'Unknown Date';

            card.innerHTML = `
                <div class="video-thumb">
                    <img src="${video.thumbnail}" alt="${video.title}" onerror="this.style.display='none'">
                    <div class="play-overlay">
                        <i class="fa-solid fa-play"></i>
                    </div>
                    <div class="thumb-fallback">
                        <i class="fa-solid fa-film"></i>
                    </div>
                </div>
                <div class="video-details">
                    <h4>${video.title}</h4>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                        <span class="date"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                        <span class="date" style="color: var(--primary);"><i class="fa-solid fa-eye"></i> ${formatViews(video.views)}</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                playVideo(video);
            });

            videoGrid.appendChild(card);
        });
        
        updatePagination();
    }

    function renderStories(storyList = currentVideoList, page = currentPage) {
        currentVideoList = storyList;
        currentPage = page;
        videoGrid.innerHTML = '';

        if (storyList.length === 0) {
            videoGrid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1; text-align:center; padding: 40px;">No stories found.</p>';
            if (paginationContainer) paginationContainer.style.display = 'none';
            return;
        }

        const startIndex = (currentPage - 1) * videosPerPage;
        const endIndex = startIndex + videosPerPage;
        const storiesToRender = storyList.slice(startIndex, endIndex);

        storiesToRender.forEach(story => {
            const card = document.createElement('div');
            card.className = 'story-card';

            const snippet = story.content ? story.content.substring(0, 150) + '...' : '';

            card.innerHTML = `
                <div class="story-thumb" style="background-image: url('${story.thumbnail}');"></div>
                <div class="story-details">
                    <h4>${story.title}</h4>
                    <div class="story-snippet">${snippet}</div>
                    <button class="read-more-btn">Read More</button>
                </div>
            `;

            card.querySelector('.read-more-btn').addEventListener('click', () => {
                openStoryModal(story);
            });

            videoGrid.appendChild(card);
        });
        
        updatePagination();
    }

    // Filter Logic
    function applyFilter(filterType) {
        if (filterType === 'Stories') {
            let sortedStories = [...stories];
            sortedStories.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
            const query = searchInput.value.toLowerCase().trim();
            if (query) {
                sortedStories = sortedStories.filter(s => s.title.toLowerCase().includes(query));
            }
            renderStories(sortedStories, 1);
            return;
        }

        let sortedVideos = [...videos];

        switch (filterType) {
            case 'Most Viewed':
                sortedVideos.sort((a, b) => (b.views || 0) - (a.views || 0));
                break;
            case 'New Releases':
                sortedVideos.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
                break;
            case 'All Videos':
            default:
                sortedVideos.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
                break;
        }

        const query = searchInput.value.toLowerCase().trim();
        if (query) {
            sortedVideos = sortedVideos.filter(v => v.title.toLowerCase().includes(query));
        }

        renderVideos(sortedVideos, 1);
    }

    // Filter Button Click Events
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            applyFilter(e.target.textContent.trim());
        });
    });

    // Search Logic
    searchInput.addEventListener('input', () => {
        const activeBtn = document.querySelector('.pill-nav a.active');
        const filterType = activeBtn ? activeBtn.textContent.trim() : 'New Releases';
        applyFilter(filterType);
    });

    // Pagination Click Events
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                const activeBtn = document.querySelector('.pill-nav a.active');
                if (activeBtn && activeBtn.textContent.trim() === 'Stories') {
                    renderStories(currentVideoList, currentPage - 1);
                } else {
                    renderVideos(currentVideoList, currentPage - 1);
                }
                window.scrollTo({ top: document.querySelector('.main-gallery').offsetTop - 100, behavior: 'smooth' });
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(currentVideoList.length / videosPerPage);
            if (currentPage < totalPages) {
                const activeBtn = document.querySelector('.pill-nav a.active');
                if (activeBtn && activeBtn.textContent.trim() === 'Stories') {
                    renderStories(currentVideoList, currentPage + 1);
                } else {
                    renderVideos(currentVideoList, currentPage + 1);
                }
                window.scrollTo({ top: document.querySelector('.main-gallery').offsetTop - 100, behavior: 'smooth' });
            }
        });
    }

    // Play Video Logic
    async function playVideo(video) {
        currentVideoId = video.id;
        
        // Increment view count in Firebase
        try {
            const videoRef = doc(db, 'videos', video.id);
            await updateDoc(videoRef, { views: increment(1) });
            // Optionally update UI immediately (mocking it until next reload)
            video.views = (video.views || 0) + 1;
        } catch (e) {
            console.error("Could not increment views", e);
        }

        modalVideoTitle.textContent = video.title;
        modalVideoDesc.textContent = video.description || 'No description provided.';
        
        if (video.type === 'collection' && video.streamtapeIds) {
            videoContainer.classList.add('collection-wrapper');
            videoContainer.innerHTML = '';
            video.streamtapeIds.forEach(id => {
                videoContainer.innerHTML += `
                    <div class="collection-video-item">
                        <iframe 
                            src="https://streamtape.com/e/${id}" 
                            allowfullscreen 
                            allowtransparency 
                            allow="autoplay; fullscreen" 
                            scrolling="no">
                        </iframe>
                    </div>
                `;
            });
        } else {
            videoContainer.classList.remove('collection-wrapper');
            const streamtapeEmbedUrl = `https://streamtape.com/e/${video.streamtapeId}`;
            videoContainer.innerHTML = `
                <iframe 
                    src="${streamtapeEmbedUrl}" 
                    allowfullscreen 
                    allowtransparency 
                    allow="autoplay; fullscreen" 
                    scrolling="no">
                </iframe>
            `;
        }
        
        if (history.state?.modal !== true) {
            history.pushState({ modal: true }, "");
        }

        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; 
    }

    // Modal Close Logic
    function closeModal(isPopState = false) {
        if (typeof isPopState !== 'boolean') {
            isPopState = false;
        }

        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        currentVideoId = null;
        
        // Remove ?v= from URL silently
        const url = new URL(window.location);
        url.searchParams.delete('v');
        window.history.replaceState({}, document.title, url.toString());
        
        setTimeout(() => {
            videoContainer.innerHTML = '';
            videoContainer.classList.remove('collection-wrapper');
        }, 300);

        if (!isPopState && history.state?.modal === true) {
            history.back();
        }
    }

    // Handle back button on mobile/desktop
    window.addEventListener('popstate', () => {
        if (modal && !modal.classList.contains('hidden')) {
            closeModal(true);
        }
    });

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            if (!currentVideoId) return;
            const shareUrl = window.location.origin + window.location.pathname + '?v=' + currentVideoId;
            navigator.clipboard.writeText(shareUrl).then(() => {
                const originalHtml = shareBtn.innerHTML;
                shareBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => {
                    shareBtn.innerHTML = originalHtml;
                }, 2000);
            });
        });
    }

    // Story Modal Logic
    const closeStoryModalBtn = document.getElementById('close-story-modal');
    const storyModal = document.getElementById('story-modal');

    function openStoryModal(story) {
        // Increment story view count (optional, can skip for now to save writes)
        try {
            updateDoc(doc(db, 'stories', story.id), { views: increment(1) });
        } catch(e) {}

        document.getElementById('story-modal-image').style.backgroundImage = `url('${story.thumbnail}')`;
        document.getElementById('story-modal-title').textContent = story.title;
        document.getElementById('story-modal-content').textContent = story.content;
        
        storyModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    if (closeStoryModalBtn) {
        closeStoryModalBtn.addEventListener('click', () => {
            storyModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        });
    }

    if (storyModal) {
        storyModal.addEventListener('click', (e) => {
            if (e.target === storyModal) {
                storyModal.classList.add('hidden');
                document.body.style.overflow = 'auto';
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modal && !modal.classList.contains('hidden')) {
                closeModal();
            }
            if (storyModal && !storyModal.classList.contains('hidden')) {
                storyModal.classList.add('hidden');
                document.body.style.overflow = 'auto';
            }
        }
    });

    loadVideos();
    loadStories();
});
