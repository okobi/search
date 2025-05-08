interface CustomVideoPlayerProps {
    src: string;
    title: string;
    poster?: string;
  }
  
  export default function CustomVideoPlayer({ src, title, poster }: CustomVideoPlayerProps) {
    return (
      <div className="w-full">
        <video controls poster={poster} className="w-full h-auto max-h-[60vh] object-contain rounded-lg">
          <source src={src} type="video/mp4" />
          Your browser does not support the video element.
        </video>
        <p className="text-sm text-gray-600 mt-2">{title}</p>
      </div>
    );
  }