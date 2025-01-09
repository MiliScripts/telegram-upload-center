export default {
    async fetch(request, env, ctx) {
        const botToken = 'YOUR-BOT-TOKEN-HERE';
        const chatId = 'YOU-ACCOUNT-CHAT-ID-YOU-STARTED-THE-BOT-WITH';
        const url = new URL(request.url);
        const domain = url.hostname;

        if (request.method === 'GET' && url.pathname === '/') {
            return new Response(getUploadForm(), {
                headers: { 'Content-Type': 'text/html' }
            });
        }

        if (request.method === 'GET' && url.pathname === '/files') {
            const sortBy = url.searchParams.get('sort') || 'date';
            const order = url.searchParams.get('order') || 'desc';
            const files = await listFiles(env.UPLOAD_STORE, sortBy, order);
            return new Response(getFilesListPage(files, sortBy, order), {
                headers: { 'Content-Type': 'text/html' }
            });
        }

        if (url.pathname === '/upload' && request.method === 'POST') {
            const formData = await request.formData();
            const file = formData.get('file');

            if (file) {
                const sendFileToChat = await postReq("sendDocument", [
                    { "chat_id": chatId },
                    { "document": file },
                    { "caption": file.name }
                ], botToken);

                const response = await sendFileToChat.json();

                if (sendFileToChat.ok) {
                    const fileIds = extractFileIds(response);
                    const downloadLinks = await generateDownloadLinks(fileIds, domain, botToken);

                    await env.UPLOAD_STORE.put(Date.now().toString(), JSON.stringify({
                        title: file.name,
                        fileName: file.name,
                        fileType: getFileType(file.name),
                        size: file.size,
                        downloadUrl: downloadLinks[0],
                        uploadDate: new Date().toISOString()
                    }));

                    return new Response(JSON.stringify({ downloadUrl: downloadLinks[0] }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }
        }

        if (url.pathname.startsWith('/download/')) {
            return handleDownload(request, botToken);
        }

        if (request.method === 'DELETE' && url.pathname.startsWith('/delete/')) {
            const key = url.pathname.split('/')[2];
            await env.UPLOAD_STORE.delete(key);
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response('Not Found', { status: 404 });
    }
};

function getFileType(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    const typeMap = {
        pdf: 'PDF Document',
        doc: 'Word Document',
        docx: 'Word Document',
        xls: 'Excel Spreadsheet',
        xlsx: 'Excel Spreadsheet',
        jpg: 'Image',
        jpeg: 'Image',
        png: 'Image',
        gif: 'Image',
        zip: 'Archive',
        rar: 'Archive',
        txt: 'Text File',
        mp4: 'Video',
        mp3: 'Audio'
    };
    return typeMap[extension] || 'Other';
}

function getFileIcon(fileType) {
    const iconMap = {
        'PDF Document': '📄',
        'Word Document': '📝',
        'Excel Spreadsheet': '📊',
        'Image': '🖼️',
        'Archive': '📦',
        'Text File': '📃',
        'Video': '🎥',
        'Audio': '🎵',
        'Other': '📎'
    };
    return iconMap[fileType] || '📎';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getUploadForm() {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>File Upload Center</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <style>
            .upload-area { border: 2px dashed #4F46E5; }
            .upload-area.dragging { background: rgba(79, 70, 229, 0.1); }
            .loading-spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #4F46E5;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body class="bg-gray-900 min-h-screen">
        <div class="container mx-auto px-4 py-8">
            <div class="max-w-xl mx-auto bg-gray-800 rounded-lg shadow-xl p-8">
                <h1 class="text-3xl font-bold text-white mb-8 text-center">File Upload Center</h1>
                
                <form action="/upload" method="POST" enctype="multipart/form-data" class="space-y-6" id="uploadForm">
                    <div class="upload-area rounded-lg p-8 text-center cursor-pointer" id="dropZone">
                        <div class="space-y-4">
                            <span class="text-4xl">📁</span>
                            <p class="text-white text-lg">Drag & drop files here or click to browse</p>
                            <p class="text-gray-400 text-sm">Maximum file size: 50MB</p>
                        </div>
                        <input type="file" name="file" id="fileInput" required class="hidden">
                    </div>

                    <div id="filePreview" class="hidden bg-gray-700 p-4 rounded-lg">
                        <div class="flex items-center space-x-4">
                            <span class="text-2xl" id="fileIcon">📄</span>
                            <div class="flex-1">
                                <p class="text-white font-medium" id="fileName">filename.txt</p>
                                <p class="text-gray-400 text-sm" id="fileSize">0 KB</p>
                            </div>
                            <button type="button" id="removeFile" class="text-red-400 hover:text-red-300">✕</button>
                        </div>
                    </div>

                    <div class="flex justify-between">
                        <button type="submit" id="uploadBtn"
                            class="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 transition disabled:opacity-50">
                            Upload File
                        </button>
                        <a href="/files" 
                            class="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 transition">
                            View Files
                        </a>
                    </div>

                    <!-- Loading Spinner -->
                    <div id="loadingSpinner" class="hidden justify-center items-center mt-4">
                        <div class="loading-spinner"></div>
                        <p class="text-white ml-2">Uploading...</p>
                    </div>

                    <!-- Copy Link Section -->
                    <div id="copyLinkSection" class="hidden mt-4">
                        <p class="text-white">File uploaded successfully! Copy the download link:</p>
                        <div class="flex items-center mt-2">
                            <input type="text" id="downloadLink" readonly class="flex-1 bg-gray-700 text-white p-2 rounded-l">
                            <button type="button" id="copyLinkBtn" class="bg-indigo-600 text-white px-4 py-2 rounded-r hover:bg-indigo-700">
                                Copy Link
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <script>
            const dropZone = document.getElementById('dropZone');
            const fileInput = document.getElementById('fileInput');
            const filePreview = document.getElementById('filePreview');
            const fileName = document.getElementById('fileName');
            const fileSize = document.getElementById('fileSize');
            const fileIcon = document.getElementById('fileIcon');
            const removeFile = document.getElementById('removeFile');
            const uploadBtn = document.getElementById('uploadBtn');
            const uploadForm = document.getElementById('uploadForm');
            const loadingSpinner = document.getElementById('loadingSpinner');
            const copyLinkSection = document.getElementById('copyLinkSection');
            const downloadLink = document.getElementById('downloadLink');
            const copyLinkBtn = document.getElementById('copyLinkBtn');

            dropZone.addEventListener('click', () => fileInput.click());
            
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragging');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragging');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragging');
                if (e.dataTransfer.files.length) {
                    fileInput.files = e.dataTransfer.files;
                    updateFilePreview(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length) {
                    updateFilePreview(e.target.files[0]);
                }
            });

            removeFile.addEventListener('click', () => {
                fileInput.value = '';
                filePreview.classList.add('hidden');
                dropZone.classList.remove('hidden');
                uploadBtn.disabled = true;
            });

            uploadForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                uploadBtn.disabled = true;
                loadingSpinner.classList.remove('hidden');

                const formData = new FormData(uploadForm);
                try {
                    const response = await fetch('/upload', {
                        method: 'POST',
                        body: formData,
                    });

                    if (response.redirected) {
                        window.location.href = response.url;
                    } else {
                        const data = await response.json();
                        if (data.downloadUrl) {
                            downloadLink.value = data.downloadUrl;
                            copyLinkSection.classList.remove('hidden');
                        }
                    }
                } catch (error) {
                    console.error('Upload failed:', error);
                } finally {
                    loadingSpinner.classList.add('hidden');
                    uploadBtn.disabled = false;
                }
            });

            copyLinkBtn.addEventListener('click', () => {
                downloadLink.select();
                document.execCommand('copy');
                alert('Link copied to clipboard!');
            });

            function updateFilePreview(file) {
                fileName.textContent = file.name;
                fileSize.textContent = formatFileSize(file.size);
                fileIcon.textContent = getFileIcon(file.type);
                filePreview.classList.remove('hidden');
                dropZone.classList.add('hidden');
                uploadBtn.disabled = false;
            }

            function formatFileSize(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }

            function getFileIcon(mimeType) {
                const typeMap = {
                    'application/pdf': '📄',
                    'application/msword': '📝',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
                    'application/vnd.ms-excel': '📊',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
                    'image/': '🖼️',
                    'video/': '🎥',
                    'audio/': '🎵',
                    'application/zip': '📦',
                    'application/x-rar-compressed': '📦',
                    'text/': '📃'
                };
                
                for (const [type, icon] of Object.entries(typeMap)) {
                    if (mimeType.startsWith(type)) return icon;
                }
                return '📎';
            }
        </script>
    </body>
    </html>`;
}

function getFilesListPage(files, currentSort, currentOrder) {
    const getSortLink = (sort) => {
        const newOrder = currentSort === sort ? (currentOrder === 'asc' ? 'desc' : 'asc') : 'desc';
        return `?sort=${sort}&order=${newOrder}`;
    };

    const getSortIcon = (sort) => {
        if (currentSort !== sort) return '↕️';
        return currentOrder === 'asc' ? '↑' : '↓';
    };

    // Calculate file type summary
    const fileTypeSummary = files.reduce((acc, file) => {
        acc[file.fileType] = (acc[file.fileType] || 0) + 1;
        return acc;
    }, {});

    const filesList = files.map(file => `
        <div class="bg-gray-800 p-6 rounded-lg shadow-md transform hover:scale-102 transition-transform">
            <div class="flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0 sm:space-x-4">
                <span class="text-4xl">${getFileIcon(file.fileType)}</span>
                <div class="flex-1">
                    <h3 class="text-xl font-semibold text-white mb-2">${file.title}</h3>
                    <div class="space-y-2 text-sm text-gray-400">
                        <p>Type: ${file.fileType}</p>
                        <p>Size: ${formatFileSize(file.size)}</p>
                        <p>Uploaded: ${new Date(file.uploadDate).toLocaleString()}</p>
                    </div>
                    <div class="flex flex-wrap gap-2 mt-4">
                        <a href="${file.downloadUrl}" 
                           class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition">
                            Download File
                        </a>
                        <button onclick="copyToClipboard('${file.downloadUrl}')" 
                                class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition">
                            Copy URL
                        </button>
                        <button onclick="openQRCodeModal('${file.downloadUrl}')" 
                                class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition">
                            Share QR Code
                        </button>
                        <button onclick="deleteFile('${file.key}')" 
                                class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition">
                            Delete File
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Uploaded Files</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js" defer></script>
    </head>
    <body class="bg-gray-900 min-h-screen">
        <div class="container mx-auto px-4 py-8">
            <div class="max-w-4xl mx-auto">
                <div class="flex flex-col sm:flex-row justify-between items-center mb-8 space-y-4 sm:space-y-0">
                    <h1 class="text-3xl font-bold text-white">Uploaded Files</h1>
                    <div class="flex space-x-4">
                        <a href="/" class="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 transition">
                            Upload New File
                        </a>
                    </div>
                </div>

                <!-- File Summary -->
                <div class="bg-gray-800 rounded-lg p-4 mb-6">
                    <h2 class="text-xl font-bold text-white mb-4">File Summary</h2>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm text-white">
                        <div class="bg-gray-700 p-3 rounded-lg">
                            <p class="font-medium">Total Files</p>
                            <p class="text-indigo-400">${files.length}</p>
                        </div>
                        ${Object.entries(fileTypeSummary).map(([type, count]) => `
                            <div class="bg-gray-700 p-3 rounded-lg">
                                <p class="font-medium">${type}</p>
                                <p class="text-indigo-400">${count}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="bg-gray-800 rounded-lg p-4 mb-6">
                    <div class="flex flex-wrap gap-4 text-sm text-white">
                        <span class="font-medium">Sort by:</span>
                        <a href="${getSortLink('date')}" 
                           class="hover:text-indigo-400 ${currentSort === 'date' ? 'text-indigo-400' : ''}">
                           Date ${getSortIcon('date')}
                        </a>
                        <a href="${getSortLink('name')}" 
                           class="hover:text-indigo-400 ${currentSort === 'name' ? 'text-indigo-400' : ''}">
                           Name ${getSortIcon('name')}
                        </a>
                        <a href="${getSortLink('type')}" 
                           class="hover:text-indigo-400 ${currentSort === 'type' ? 'text-indigo-400' : ''}">
                           Type ${getSortIcon('type')}
                        </a>
                        <a href="${getSortLink('size')}" 
                           class="hover:text-indigo-400 ${currentSort === 'size' ? 'text-indigo-400' : ''}">
                           Size ${getSortIcon('size')}
                        </a>
                    </div>
                </div>

                <div class="grid gap-6">
                    ${filesList}
                </div>

                ${files.length === 0 ? `
                    <div class="text-center py-12">
                        <span class="text-4xl mb-4 block">📁</span>
                        <p class="text-white text-lg">No files uploaded yet</p>
                        <a href="/" class="text-indigo-400 hover:text-indigo-300">Upload your first file</a>
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- QR Code Modal -->
        <div id="qrCodeModal" class="fixed inset-0 bg-black bg-opacity-50 hidden justify-center items-center p-4">
            <div class="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
                <h2 class="text-xl font-bold text-white mb-4">Share QR Code</h2>
                <div id="qrCodeContainer" class="flex justify-center mb-4 bg-white p-4 rounded"></div>
                <button onclick="closeQRCodeModal()" 
                        class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition w-full">
                    Close
                </button>
            </div>
        </div>

        <script>
            function copyToClipboard(text) {
                navigator.clipboard.writeText(text).then(() => {
                    alert('URL copied to clipboard!');
                }).catch(() => {
                    alert('Failed to copy URL.');
                });
            }

            function openQRCodeModal(url) {
                const modal = document.getElementById('qrCodeModal');
                const qrCodeContainer = document.getElementById('qrCodeContainer');
                modal.classList.remove('hidden');
                modal.style.display = 'flex';
                qrCodeContainer.innerHTML = ''; // Clear previous QR code

                // Wait for QRCode to be available
                if (typeof QRCode !== 'undefined') {
                    try {
                        new QRCode(qrCodeContainer, {
                            text: url,
                            width: 200,
                            height: 200,
                            colorDark: "#000000",
                            colorLight: "#ffffff",
                            correctLevel: QRCode.CorrectLevel.H
                        });
                    } catch (error) {
                        console.error('Error generating QR code:', error);
                        qrCodeContainer.innerHTML = '<p class="text-red-500">Failed to generate QR code</p>';
                    }
                } else {
                    console.error('QRCode library not loaded');
                    qrCodeContainer.innerHTML = '<p class="text-red-500">QR Code generator not available</p>';
                }
            }

            function closeQRCodeModal() {
                const modal = document.getElementById('qrCodeModal');
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }

            function deleteFile(key) {
                if (confirm('Are you sure you want to delete this file?')) {
                    fetch(\`/delete/\${key}\`, {
                        method: 'DELETE'
                    }).then(response => {
                        if (response.ok) {
                            window.location.reload();
                        } else {
                            alert('Failed to delete the file.');
                        }
                    }).catch(error => {
                        console.error('Error:', error);
                        alert('Failed to delete the file.');
                    });
                }
            }

            // Close modal when clicking outside
            document.getElementById('qrCodeModal').addEventListener('click', function(event) {
                if (event.target === this) {
                    closeQRCodeModal();
                }
            });

            // Check if QRCode library is loaded
            window.addEventListener('load', function() {
                if (typeof QRCode === 'undefined') {
                    console.error('QRCode library failed to load');
                }
            });
        </script>
    </body>
    </html>`;
}

async function listFiles(kv, sortBy = 'date', order = 'desc') {
    const list = await kv.list();
    const files = [];
    
    for (const key of list.keys) {
        const value = await kv.get(key.name);
        files.push({ ...JSON.parse(value), key: key.name });
    }
    
    // Sort files based on selected criteria
    files.sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return order === 'asc' 
                    ? a.title.localeCompare(b.title)
                    : b.title.localeCompare(a.title);
            case 'type':
                return order === 'asc'
                    ? a.fileType.localeCompare(b.fileType)
                    : b.fileType.localeCompare(a.fileType);
            case 'size':
                return order === 'asc'
                    ? a.size - b.size
                    : b.size - a.size;
            case 'date':
            default:
                return order === 'asc'
                    ? new Date(a.uploadDate) - new Date(b.uploadDate)
                    : new Date(b.uploadDate) - new Date(a.uploadDate);
        }
    });
    
    return files;
}

async function postReq(url, fields, botToken) {
    const formData = new FormData();
    fields.forEach(obj => {
        for (let key in obj) {
            formData.append(key, obj[key]);
        }
    });

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/${url}`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response;
    } catch (error) {
        console.error('Error in postReq:', error);
        throw error;
    }
}

function extractFileIds(obj) {
    const fileIds = [];
    function searchForFileIds(item) {
        if (item && typeof item === 'object') {
            if (item.file_id) fileIds.push(item.file_id);
            Object.values(item).forEach(searchForFileIds);
        }
    }
    searchForFileIds(obj);
    return [...new Set(fileIds)];
}

async function generateDownloadLinks(fileIds, domain, botToken) {
    try {
        const links = await Promise.all(fileIds.map(async (fid) => {
            const fileResponse = await postReq(`getFile`, [{ "file_id": fid }], botToken);
            const fileData = await fileResponse.json();
            return fileData.ok ? `https://${domain}/download/${fid}/${fileData.result.file_path}` : null;
        }));
        return links.filter(link => link !== null);
    } catch (error) {
        console.error('Error generating download links:', error);
        throw error;
    }
}

async function handleDownload(request, botToken) {
    try {
        const pathParts = new URL(request.url).pathname.split('/');
        const fileId = pathParts[2];
        
        const fileResponse = await postReq(`getFile`, [{ "file_id": fileId }], botToken);
        const fileData = await fileResponse.json();
        
        if (fileData.ok) {
            const telegramFile = await fetch(`https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`);
            const headers = new Headers(telegramFile.headers);
            
            // Add additional headers for better download experience
            headers.set('Content-Disposition', `attachment; filename="${fileData.result.file_path.split('/').pop()}"`);
            headers.set('Cache-Control', 'public, max-age=3600');
            
            return new Response(telegramFile.body, { headers });
        }
        
        return new Response('File not found', { 
            status: 404,
            headers: { 'Content-Type': 'text/plain' }
        });
    } catch (error) {
        console.error('Error handling download:', error);
        return new Response('Error processing download', { 
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}
