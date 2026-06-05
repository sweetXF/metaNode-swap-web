interface FooterProps {
    onClose: () => void;
    handleAddClick: () => void;
}

export const ModalFooter = ({
    onClose,
    handleAddClick
}: FooterProps) => {
    return (
        <>
            <button
                onClick={() => onClose()}
                className="px-4 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
                Cancel
            </button>
            <button
                onClick={() => handleAddClick()}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
                Add
            </button>
      </>
    )
};