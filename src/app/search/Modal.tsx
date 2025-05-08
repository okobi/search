import CustomAudioPlayer from './CustomAudioPlayer';
import CustomVideoPlayer from './CustomVideoPlayer';

interface MediaResult {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  videoURL?: string;
  creator?: string;
  license: string;
  source: 'openverse' | 'pixabay';
  tags?: string[];
  largeImageURL?: string;
  previewURL?: string;
  size?: number;
}

interface ModalProps {
  selectedItem: MediaResult | null;
  modalType: 'image' | 'audio' | 'video' | null;
  relatedItems: MediaResult[];
  relatedTotal: number | null;
  relatedLoading: boolean;
  getDisplayTitle: (item: MediaResult) => string;
  handleTagClick: (tag: string) => void;
  handleRelatedItemClick: (item: MediaResult) => void;
  handleLoadMoreRelated: () => void;
  handleDownload: (url: string, filename: string, mediaType: 'image' | 'audio' | 'video', source: 'openverse' | 'pixabay') => void;
  closeModal: () => void;
}

export default function Modal({
  selectedItem,
  modalType,
  relatedItems,
  relatedTotal,
  relatedLoading,
  getDisplayTitle,
  handleTagClick,
  handleRelatedItemClick,
  handleLoadMoreRelated,
  handleDownload,
  closeModal,
}: ModalProps) {
  if (!selectedItem || !modalType) return null;

  const hasMoreRelated = relatedTotal !== null && relatedItems.length < relatedTotal;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 flex flex-col gap-6">
          {/* Header Section */}
          <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold text-gray-800">{getDisplayTitle(selectedItem)}</h2>
            <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          {/* Media Display Section */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Media Preview */}
              <div className="flex-1">
                {modalType === 'image' && (
                  <img
                    src={selectedItem.largeImageURL || selectedItem.thumbnail || selectedItem.url}
                    alt={selectedItem.title}
                    className="w-full h-auto max-h-96 object-contain rounded-lg"
                    onError={(e) => (e.currentTarget.src = '/placeholder-image.png')}
                  />
                )}
                {modalType === 'audio' && (
                  <div className="flex flex-col gap-4">
                    <img
                      src={selectedItem.thumbnail || '/placeholder-audio.png'}
                      alt={selectedItem.title}
                      className="w-full h-48 object-cover rounded-lg"
                      onError={(e) => (e.currentTarget.src = '/placeholder-audio.png')}
                    />
                    <CustomAudioPlayer src={selectedItem.url} title={selectedItem.title} />
                  </div>
                )}
                {modalType === 'video' && selectedItem.videoURL && (
                  <CustomVideoPlayer src={selectedItem.videoURL} poster={selectedItem.thumbnail} title={selectedItem.title} />
                )}
              </div>

              {/* Metadata Section */}
              <div className="sm:w-1/3 flex flex-col gap-2">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Creator:</span> {selectedItem.creator || 'Unknown'}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Source:</span> {selectedItem.source}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">License:</span> {selectedItem.license}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Size:</span> {selectedItem.size ? `${(selectedItem.size / 1024).toFixed(1)} KB` : 'Unknown'}
                </p>
                {selectedItem.tags && selectedItem.tags.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-semibold text-gray-600">Tags:</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedItem.tags.map((tag, index) => (
                        <button
                          key={index}
                          onClick={() => handleTagClick(tag)}
                          className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full hover:bg-gray-300 transition"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {modalType === 'image' && selectedItem.source === 'pixabay' ? (
                    <>
                      {selectedItem.largeImageURL && (
                        <button
                          onClick={() => handleDownload(selectedItem.largeImageURL!, `${selectedItem.title}-large.jpg`, 'image', 'pixabay')}
                          className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition"
                        >
                          Large
                        </button>
                      )}
                      {selectedItem.thumbnail && (
                        <button
                          onClick={() => handleDownload(selectedItem.thumbnail, `${selectedItem.title}-medium.jpg`, 'image', 'pixabay')}
                          className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition"
                        >
                          Medium
                        </button>
                      )}
                      {selectedItem.previewURL && (
                        <button
                          onClick={() => handleDownload(selectedItem.previewURL!, `${selectedItem.title}-small.jpg`, 'image', 'pixabay')}
                          className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition"
                        >
                          Small
                        </button>
                      )}
                    </>
                  ) : modalType === 'image' && selectedItem.source === 'openverse' ? (
                    <button
                      onClick={() => handleDownload(selectedItem.url, selectedItem.title, 'image', 'openverse')}
                      className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition"
                    >
                      Download
                    </button>
                  ) : modalType === 'audio' ? (
                    <button
                      onClick={() => handleDownload(selectedItem.url, selectedItem.title, 'audio', 'openverse')}
                      className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition"
                    >
                      Download
                    </button>
                  ) : modalType === 'video' && selectedItem.videoURL ? (
                    <button
                      onClick={() => handleDownload(selectedItem.videoURL!, selectedItem.title, 'video', 'pixabay')}
                      className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition"
                    >
                      Download
                    </button>
                  ) : null}
                  <a
                    href={selectedItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
                  >
                    View {modalType === 'image' ? 'Image' : modalType === 'audio' ? 'Audio' : 'Video'}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Related Items Section */}
          {relatedItems.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Related {modalType === 'audio' ? 'audio' : modalType === 'video' ? 'videos' : 'images'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {relatedItems.map((item, index) => (
                  <div
                    key={`${item.source}-${item.id}-${index}`}
                    onClick={() => handleRelatedItemClick(item)}
                    className="bg-gray-50 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition"
                  >
                    <img
                      src={item.thumbnail || (modalType === 'audio' ? '/placeholder-audio.png' : modalType === 'video' ? '/placeholder-video.png' : '/placeholder-image.png')}
                      alt={item.title}
                      className="w-full h-32 object-cover"
                      onError={(e) =>
                        (e.currentTarget.src =
                          modalType === 'audio'
                            ? '/placeholder-audio.png'
                            : modalType === 'video'
                            ? '/placeholder-video.png'
                            : '/placeholder-image.png')
                      }
                    />
                    <div className="p-3">
                      <p className="text-sm font-medium text-gray-800 truncate">{getDisplayTitle(item)}</p>
                      <p className="text-xs text-gray-600">Source: {item.source}</p>
                    </div>
                  </div>
                ))}
              </div>
              {hasMoreRelated && (
                <div className="text-center mt-6">
                  <button
                    onClick={handleLoadMoreRelated}
                    className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition disabled:opacity-50"
                    disabled={relatedLoading}
                  >
                    {relatedLoading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}