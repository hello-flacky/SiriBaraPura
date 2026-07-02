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
    
    // View Mode from URL
    const urlParams = new URLSearchParams(window.location.search);
    const currentView = urlParams.get('view'); // 'videos' or 'stories' or null

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
            
            // Sort newest first by default
            videos.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
            
            // Hide section if viewing only stories
            if (currentView === 'stories') {
                document.getElementById('videos-section').style.display = 'none';
            } else {
                renderVideos(videos, 1);
            }
            
            // Check for shared video link
            const sharedVideoId = urlParams.get('v');
            if (sharedVideoId) {
                const videoToPlay = videos.find(v => v.id === sharedVideoId);
                if (videoToPlay) {
                    playVideo(videoToPlay);
                }
            }
        } catch (error) {
            console.error("Error fetching videos: ", error);
            const videosGrid = document.getElementById('videos-grid');
            if(videosGrid) {
                videosGrid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1; text-align:center; padding: 40px;">Please configure Firebase in firebase-config.js to see videos.</p>';
            }
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
            
            if (currentView === 'videos') {
                document.getElementById('stories-section').style.display = 'none';
            } else {
                renderStories(stories, 1);
            }
        } catch (error) {
            console.error("Error fetching stories: ", error);
            const storiesGrid = document.getElementById('stories-grid');
            if(storiesGrid) {
                storiesGrid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1; text-align:center; padding: 40px;">Failed to load stories.</p>';
            }
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
    function renderVideos(videoList = currentVideoList, page = 1) {
        currentVideoList = videoList;
        currentPage = page;
        const videosGrid = document.getElementById('videos-grid');
        if (!videosGrid) return;
        videosGrid.innerHTML = '';

        if (videoList.length === 0) {
            videosGrid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1; text-align:center; padding: 40px;">No videos found.</p>';
            if (paginationContainer) paginationContainer.style.display = 'none';
            return;
        }

        let videosToRender = videoList;
        
        // If not explicitly viewing all videos, limit to 10 and hide pagination
        if (currentView !== 'videos') {
            videosToRender = videoList.slice(0, 10);
            if (paginationContainer) paginationContainer.style.display = 'none';
            const viewAllLink = document.getElementById('view-all-videos');
            if (viewAllLink) viewAllLink.style.display = 'block';
        } else {
            const startIndex = (currentPage - 1) * videosPerPage;
            const endIndex = startIndex + videosPerPage;
            videosToRender = videoList.slice(startIndex, endIndex);
            const viewAllLink = document.getElementById('view-all-videos');
            if (viewAllLink) viewAllLink.style.display = 'none';
        }

        videosToRender.forEach(video => {
            const card = document.createElement('div');
            card.className = 'modern-card';

            const isCollection = video.type === 'collection';
            const badgeIcon = isCollection ? '<i class="fa-solid fa-layer-group"></i>' : '<i class="fa-solid fa-play"></i>';
            const badgeText = isCollection ? 'Collection' : 'Video';
            
            let countBadge = '';
            if (isCollection && video.streamtapeIds && video.streamtapeIds.length > 0) {
                countBadge = `<span class="collection-count-badge">${video.streamtapeIds.length} Videos</span>`;
            }
            
            const dateStr = video.dateAdded ? new Date(video.dateAdded).toLocaleDateString() : 'Unknown';

            card.innerHTML = `
                <div class="card-img-wrapper img-protect-container" style="aspect-ratio: 16/10; height: auto;">
                    <span class="type-badge badge-video">${badgeIcon} ${badgeText}</span>
                    ${countBadge}
                    <img src="${video.thumbnail}" class="protected-img" onerror="this.src='https://via.placeholder.com/320x180.png?text=No+Thumbnail'">
                </div>
                <div class="card-details">
                    <h6 class="fw-bold text-truncate small mb-0" style="color: var(--text-main); font-weight: 600; font-size: 0.95rem; margin-bottom: 8px;">${video.title}</h6>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
                        <span class="date" style="color: var(--text-muted); font-size: 0.75rem;"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                        <span class="date" style="color: var(--hot-pink); font-size: 0.75rem;"><i class="fa-solid fa-eye"></i> ${formatViews(video.views)}</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                playVideo(video);
            });

            videosGrid.appendChild(card);
        });
        
        updatePagination();
    }

    function renderStories(storyList = stories, page = 1) {
        const storiesGrid = document.getElementById('stories-grid');
        const storiesPagination = document.getElementById('stories-pagination-container');
        if (!storiesGrid) return;
        storiesGrid.innerHTML = '';

        if (storyList.length === 0) {
            storiesGrid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1; text-align:center; padding: 40px;">No stories found.</p>';
            if (storiesPagination) storiesPagination.style.display = 'none';
            return;
        }

        let sortedStories = [...storyList].sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
        let storiesToRender = sortedStories;

        if (currentView !== 'stories') {
            storiesToRender = sortedStories.slice(0, 6);
            if (storiesPagination) storiesPagination.style.display = 'none';
            const viewAllLink = document.getElementById('view-all-stories');
            if (viewAllLink) viewAllLink.style.display = 'block';
        } else {
            const startIndex = (page - 1) * videosPerPage;
            const endIndex = startIndex + videosPerPage;
            storiesToRender = sortedStories.slice(startIndex, endIndex);
            
            const viewAllLink = document.getElementById('view-all-stories');
            if (viewAllLink) viewAllLink.style.display = 'none';
            
            if (storiesPagination) {
                const totalPages = Math.ceil(sortedStories.length / videosPerPage);
                if (totalPages > 1) {
                    storiesPagination.style.display = 'flex';
                    document.getElementById('stories-page-info').textContent = `Page ${page} of ${totalPages}`;
                    document.getElementById('stories-prev-page').disabled = page === 1;
                    document.getElementById('stories-next-page').disabled = page === totalPages;
                    
                    document.getElementById('stories-prev-page').onclick = () => renderStories(storyList, page - 1);
                    document.getElementById('stories-next-page').onclick = () => renderStories(storyList, page + 1);
                } else {
                    storiesPagination.style.display = 'none';
                }
            }
        }

        storiesToRender.forEach(story => {
            const card = document.createElement('div');
            card.className = 'modern-card';

            const dateStr = story.dateAdded ? new Date(story.dateAdded).toLocaleDateString() : 'Unknown';

            card.innerHTML = `
                <div class="card-img-wrapper img-protect-container" style="aspect-ratio: 16/10; height: auto;">
                    <span class="type-badge badge-story">Story</span>
                    <img src="${story.thumbnail}" class="protected-img" onerror="this.src='https://via.placeholder.com/320x180.png?text=No+Thumbnail'">
                </div>
                <div class="card-details">
                    <h6 class="fw-bold text-truncate mb-2" style="color: var(--text-main); font-size: 0.95rem; margin-bottom: 8px;">${story.title}</h6>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
                        <small style="color: var(--hot-pink); font-weight: 600;"><i class="far fa-user me-1"></i>Admin</small>
                        <small style="color: var(--text-muted); font-size: 0.75rem;"><i class="far fa-clock me-1"></i>${dateStr}</small>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                openStoryModal(story);
            });

            storiesGrid.appendChild(card);
        });
    }

    // Filter Logic (Search functionality applies to both)
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            
            let filteredVideos = videos;
            if (query) {
                filteredVideos = videos.filter(v => v.title.toLowerCase().includes(query));
            }
            renderVideos(filteredVideos, 1);
            
            let filteredStories = stories;
            if (query) {
                filteredStories = stories.filter(s => s.title.toLowerCase().includes(query));
            }
            renderStories(filteredStories);
        });
    }

    // Pagination Click Events
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                renderVideos(currentVideoList, currentPage - 1);
                window.scrollTo({ top: document.querySelector('.main-gallery').offsetTop - 100, behavior: 'smooth' });
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(currentVideoList.length / videosPerPage);
            if (currentPage < totalPages) {
                renderVideos(currentVideoList, currentPage + 1);
                window.scrollTo({ top: document.querySelector('.main-gallery').offsetTop - 100, behavior: 'smooth' });
            }
        });
    }

    // Play Video Logic
    async function playVideo(video) {
        currentVideoId = video.id;
        
        try {
            const videoRef = doc(db, 'videos', video.id);
            await updateDoc(videoRef, { views: increment(1) });
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
                        <iframe src="https://streamtape.com/e/${id}" allowfullscreen allowtransparency allow="autoplay; fullscreen" scrolling="no"></iframe>
                    </div>
                `;
            });
        } else {
            videoContainer.classList.remove('collection-wrapper');
            videoContainer.innerHTML = `<iframe src="https://streamtape.com/e/${video.streamtapeId}" allowfullscreen allowtransparency allow="autoplay; fullscreen" scrolling="no"></iframe>`;
        }
        
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // History API for Android Back Button handling
        history.pushState({ modalOpen: true }, '');
    }

    function closeModal() {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        
        const videoContainer = document.getElementById('video-container');
        videoContainer.innerHTML = '';
        currentVideoId = null;
        
        if (history.state && history.state.modalOpen) {
            history.back();
        }
    }

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
        try {
            updateDoc(doc(db, 'stories', story.id), { views: increment(1) });
        } catch(e) {}

        document.getElementById('story-modal-image').style.backgroundImage = `url('${story.thumbnail}')`;
        document.getElementById('story-modal-title').textContent = story.title;
        document.getElementById('story-modal-content').textContent = story.content;
        
        storyModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        history.pushState({ modalOpen: true }, '');
    }

    if (closeStoryModalBtn) {
        closeStoryModalBtn.addEventListener('click', () => {
            storyModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
            if (history.state && history.state.modalOpen) {
                history.back();
            }
        });
    }

    if (storyModal) {
        storyModal.addEventListener('click', (e) => {
            if (e.target === storyModal) {
                storyModal.classList.add('hidden');
                document.body.style.overflow = 'auto';
                if (history.state && history.state.modalOpen) {
                    history.back();
                }
            }
        });
    }
    
    // Listen for back button press
    window.addEventListener('popstate', (e) => {
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
            document.body.style.overflow = 'auto';
            document.getElementById('video-container').innerHTML = '';
            currentVideoId = null;
        }
        if (storyModal && !storyModal.classList.contains('hidden')) {
            storyModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    });

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
