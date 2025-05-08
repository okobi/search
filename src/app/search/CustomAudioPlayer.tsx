interface CustomAudioPlayerProps {
    src: string;
    title: string;
  }
  
  export default function CustomAudioPlayer({ src, title }: CustomAudioPlayerProps) {
    return (
      <div className="w-full">
        <audio controls className="w-full">
          <source src={src} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
        <p className="text-sm text-gray-600 mt-2">{title}</p>
      </div>
    );
  }