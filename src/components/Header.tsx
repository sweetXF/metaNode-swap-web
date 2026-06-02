import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link,useLocation } from "react-router-dom";

const Header = () => {
    const pathname=useLocation().pathname;

    const Links=[
        {
            name:'Swap',
            path:'/swap'
        },
        {
            name:'Pool',
            path:'/pool'
        },
        // {
        //     name:'Position',
        //     path:'/position'
        // }
        
    ]
    return (
        <div className="bg-white shadow-md border-b border-gray-100 px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <nav className="hidden md:flex items-center space-x-6 lg:space-x-8">
                    {Links.map((link)=>{
                        const isActive= pathname===link.path;

                        return (
                        <Link 
                            key={link.name} 
                            to={link.path}
                            className={` font-medium transition-colors duration-200 px-3 py-2 rounded-md 
                                ${
                                    isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                        >
                           {link.name}
                        </Link>)
                    })}
                </nav>

                <div className="flex items-center">
                    <ConnectButton />
                </div>
            </div>
        </div>
    )
}

export  default Header;