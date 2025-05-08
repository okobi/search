interface TabNavigationProps {
    activeTab: 'images' | 'audio' | 'videos';
    setActiveTab: (tab: 'images' | 'audio' | 'videos') => void;
  }
  
  export default function TabNavigation({ activeTab, setActiveTab }: TabNavigationProps) {
    return (
      <div className="flex space-x-4 mb-8 relative">
        {(['images', 'audio', 'videos'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-4 py-2 text-lg font-medium transition-colors duration-300 ${
              activeTab === tab ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-500'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full transition-all duration-300"></span>
            )}
          </button>
        ))}
      </div>
    );
  }