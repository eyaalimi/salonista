-- Add costPrice to Product
ALTER TABLE "Product" ADD COLUMN "costPrice" DECIMAL(10,3);

-- Add unitCost to StockMovement
ALTER TABLE "StockMovement" ADD COLUMN "unitCost" DECIMAL(10,3);
