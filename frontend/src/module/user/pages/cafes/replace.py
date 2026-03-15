import sys
import re

file_path = r'c:\Users\HP\Desktop\company\BunBurst\frontend\src\module\user\pages\cafes\CafeDetails.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Quantity Selector Div class
content = content.replace(
    'className={`flex items-center gap-3 border-2 rounded-lg px-3 h-[44px] bg-white dark:bg-[#2a2a2a] ${shouldShowGrayscale\n                        ? \'border-gray-300 dark:border-gray-700 opacity-50\'',
    'className={`flex items-center gap-3 border-2 rounded-lg px-3 h-[44px] bg-white dark:bg-[#2a2a2a] ${shouldShowGrayscale || isItemOutOfStock(selectedItem)\n                        ? \'border-gray-300 dark:border-gray-700 opacity-50\''
)

# Decrease button
content = content.replace(
    'if (!shouldShowGrayscale) {\n                              setItemDetailQuantity((prev) => Math.max(1, prev - 1))\n                            }',
    'if (!shouldShowGrayscale && !isItemOutOfStock(selectedItem)) {\n                              setItemDetailQuantity((prev) => Math.max(1, prev - 1))\n                            }'
)
content = content.replace(
    'disabled={itemDetailQuantity <= 1 || shouldShowGrayscale}',
    'disabled={itemDetailQuantity <= 1 || shouldShowGrayscale || isItemOutOfStock(selectedItem)}'
)
content = content.replace(
    'className={`${shouldShowGrayscale\n                            ? \'text-gray-300 dark:text-gray-600 cursor-not-allowed\'',
    'className={`${shouldShowGrayscale || isItemOutOfStock(selectedItem)\n                            ? \'text-gray-300 dark:text-gray-600 cursor-not-allowed\''
)

# Increase button
content = content.replace(
    'if (!shouldShowGrayscale) {\n                              setItemDetailQuantity((prev) => prev + 1)\n                            }',
    'if (!shouldShowGrayscale && !isItemOutOfStock(selectedItem)) {\n                              setItemDetailQuantity((prev) => prev + 1)\n                            }'
)
content = content.replace(
    'disabled={shouldShowGrayscale}\n                          className={shouldShowGrayscale',
    'disabled={shouldShowGrayscale || isItemOutOfStock(selectedItem)}\n                          className={shouldShowGrayscale || isItemOutOfStock(selectedItem)}'
)

# Add item button
content = content.replace(
    'className={`flex-1 h-[44px] rounded-lg font-semibold flex items-center justify-center gap-2 ${shouldShowGrayscale\n                          ? \'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-600 cursor-not-allowed opacity-50\'',
    'className={`flex-1 h-[44px] rounded-lg font-semibold flex items-center justify-center gap-2 ${shouldShowGrayscale || isItemOutOfStock(selectedItem)\n                          ? \'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-600 cursor-not-allowed opacity-50\''
)
content = content.replace(
    'onClick={(e) => {\n                          if (!shouldShowGrayscale) {\n                            updateItemQuantity(selectedItem, itemDetailQuantity, e, selectedAddons)\n                            setShowItemDetail(false)\n                          }\n                        }}\n                        disabled={shouldShowGrayscale}\n                      >\n                        <span>Add item</span>\n                        <div className="flex items-center gap-1">\n                          <span className="text-base font-bold">\n                            ₹{Math.round(calculateTotalPrice())}\n                          </span>\n                        </div>\n                      </Button>',
    'onClick={(e) => {\n                          if (!shouldShowGrayscale && !isItemOutOfStock(selectedItem)) {\n                            updateItemQuantity(selectedItem, itemDetailQuantity, e, selectedAddons)\n                            setShowItemDetail(false)\n                          }\n                        }}\n                        disabled={shouldShowGrayscale || isItemOutOfStock(selectedItem)}\n                      >\n                        {isItemOutOfStock(selectedItem) ? (\n                          <span>OUT OF STOCK</span>\n                        ) : (\n                          <>\n                            <span>Add item</span>\n                            <div className="flex items-center gap-1">\n                              <span className="text-base font-bold">\n                                ₹{Math.round(calculateTotalPrice())}\n                              </span>\n                            </div>\n                          </>\n                        )}\n                      </Button>'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
