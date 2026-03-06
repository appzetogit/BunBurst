import Cafe from '../models/Cafe.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { createCafeFromOnboarding } from './cafeController.js';

// Get current cafe's onboarding data
export const getOnboarding = async (req, res) => {
  try {
    // Check if cafe is authenticated
    if (!req.cafe || !req.cafe._id) {
      return errorResponse(res, 401, 'Cafe not authenticated');
    }

    const cafeId = req.cafe._id;
    const cafe = await Cafe.findById(cafeId).select('onboarding').lean();

    if (!cafe) {
      return errorResponse(res, 404, 'Cafe not found');
    }

    return successResponse(res, 200, 'Onboarding data retrieved', {
      onboarding: cafe.onboarding || null,
    });
  } catch (error) {
    console.error('Error fetching cafe onboarding:', error);
    return errorResponse(res, 500, 'Failed to fetch onboarding data');
  }
};

// Upsert onboarding data (all steps in one payload)
export const upsertOnboarding = async (req, res) => {
  try {
    const cafeId = req.cafe._id;
    const { step1, step2, step3, step4, completedSteps } = req.body;

    // Get existing cafe data to merge if needed
    const existingCafe = await Cafe.findById(cafeId).lean();
    const existingOnboarding = existingCafe?.onboarding || {};

    const update = {};
    
    // Step1: Always update if provided
    if (step1) {
      update['onboarding.step1'] = step1;
    }
    
    // Step2: Update if provided (even if empty arrays, as user might be clearing data)
    if (step2 !== undefined && step2 !== null) {
      update['onboarding.step2'] = step2;
    }
    
    // Step3: Update if provided (replace completely, as frontend sends full step3 object)
    if (step3 !== undefined && step3 !== null) {
      update['onboarding.step3'] = step3;
    }
    
    // Step4: Always update if provided
    if (step4 !== undefined && step4 !== null) {
      update['onboarding.step4'] = step4;
    }
    
    // Update completedSteps if provided (always update, even if 0)
    if (typeof completedSteps === 'number' && completedSteps !== null && completedSteps !== undefined) {
      update['onboarding.completedSteps'] = completedSteps;
    }

    console.log('📝 Onboarding update payload:', {
      hasStep1: !!step1,
      hasStep2: step2 !== undefined,
      hasStep3: step3 !== undefined,
      hasStep4: !!step4,
      completedSteps,
      step2Data: step2 ? {
        menuImageUrlsCount: step2.menuImageUrls?.length || 0,
        hasProfileImage: !!step2.profileImageUrl,
        cuisinesCount: step2.cuisines?.length || 0,
        openDaysCount: step2.openDays?.length || 0,
        deliveryTimings: step2.deliveryTimings,
      } : null,
      step3Data: step3 ? {
        hasPan: !!step3.pan,
        hasGst: !!step3.gst,
        hasFssai: !!step3.fssai,
        hasBank: !!step3.bank,
        panNumber: step3.pan?.panNumber,
        gstRegistered: step3.gst?.isRegistered,
        fssaiNumber: step3.fssai?.registrationNumber,
        bankAccount: step3.bank?.accountNumber,
      } : null,
      updateKeys: Object.keys(update),
    });

    const cafe = await Cafe.findByIdAndUpdate(
      cafeId,
      { $set: update },
      {
        new: true,
        upsert: false,
      }
    );

    if (!cafe) {
      return errorResponse(res, 404, 'Cafe not found');
    }

    const onboarding = cafe.onboarding;
    
    // Log saved data for verification
    console.log('✅ Onboarding data saved:', {
      completedSteps: onboarding.completedSteps,
      step1Saved: !!onboarding.step1,
      step2Saved: onboarding.step2 ? {
        menuImageUrlsCount: onboarding.step2.menuImageUrls?.length || 0,
        hasProfileImage: !!onboarding.step2.profileImageUrl,
        cuisinesCount: onboarding.step2.cuisines?.length || 0,
        openDaysCount: onboarding.step2.openDays?.length || 0,
      } : null,
      step3Saved: onboarding.step3 ? {
        hasPan: !!onboarding.step3.pan,
        hasGst: !!onboarding.step3.gst,
        hasFssai: !!onboarding.step3.fssai,
        hasBank: !!onboarding.step3.bank,
        panNumber: onboarding.step3.pan?.panNumber,
        gstRegistered: onboarding.step3.gst?.isRegistered,
        fssaiNumber: onboarding.step3.fssai?.registrationNumber,
        bankAccount: onboarding.step3.bank?.accountNumber,
      } : null,
      step4Saved: onboarding.step4 ? {
        estimatedDeliveryTime: onboarding.step4.estimatedDeliveryTime,
        distance: onboarding.step4.distance,
        priceRange: onboarding.step4.priceRange,
        featuredDish: onboarding.step4.featuredDish,
      } : null,
    });

    // If onboarding is complete (step 4), update cafe with final data
    // Also update cafe schema when step2 is completed (for immediate data availability)
    // Check both the request body and the saved document's completedSteps
    const finalCompletedSteps = onboarding.completedSteps || completedSteps;
    
    // Update cafe schema when step1 is completed (basic info)
    if (finalCompletedSteps >= 1 && step1) {
      console.log('🔄 Step1 completed, updating cafe schema with step1 data...');
      try {
        const updateData = {};
        if (step1.cafeName) {
          updateData.name = step1.cafeName;
        }
        if (step1.ownerName) {
          updateData.ownerName = step1.ownerName;
        }
        if (step1.ownerEmail) {
          updateData.ownerEmail = step1.ownerEmail;
        }
        if (step1.ownerPhone) {
          updateData.ownerPhone = step1.ownerPhone;
        }
        if (step1.primaryContactNumber) {
          updateData.primaryContactNumber = step1.primaryContactNumber;
        }
        if (step1.location) {
          updateData.location = step1.location;
        }
        
        if (Object.keys(updateData).length > 0) {
          await Cafe.findByIdAndUpdate(cafeId, { $set: updateData });
          console.log('✅ Cafe schema updated with step1 data:', Object.keys(updateData));
        }
      } catch (step1UpdateError) {
        console.error('⚠️ Error updating cafe schema with step1 data:', step1UpdateError);
        // Don't fail the request, just log the error
      }
    }
    
    // Update cafe schema when step2 is completed (cuisines, openDays, menuImages, etc.)
    if (finalCompletedSteps >= 2 && step2) {
      console.log('🔄 Step2 completed, updating cafe schema with step2 data...');
      console.log('📦 Step2 data received:', {
        hasProfileImage: !!step2.profileImageUrl,
        hasMenuImages: !!step2.menuImageUrls,
        menuImagesCount: step2.menuImageUrls?.length || 0,
        cuisines: step2.cuisines,
        openDays: step2.openDays,
        deliveryTimings: step2.deliveryTimings,
      });
      try {
        const updateData = {};
        if (step2.profileImageUrl) {
          updateData.profileImage = step2.profileImageUrl;
        }
        if (step2.menuImageUrls !== undefined) {
          updateData.menuImages = step2.menuImageUrls; // Update even if empty array
        }
        if (step2.cuisines !== undefined) {
          updateData.cuisines = step2.cuisines; // Update even if empty array
        }
        if (step2.deliveryTimings) {
          updateData.deliveryTimings = step2.deliveryTimings;
        }
        if (step2.openDays !== undefined) {
          updateData.openDays = step2.openDays; // Update even if empty array
        }
        
        if (Object.keys(updateData).length > 0) {
          const updated = await Cafe.findByIdAndUpdate(cafeId, { $set: updateData }, { new: true });
          console.log('✅ Cafe schema updated with step2 data:', {
            updatedFields: Object.keys(updateData),
            cuisines: updated?.cuisines,
            openDays: updated?.openDays,
            menuImagesCount: updated?.menuImages?.length || 0,
          });
        } else {
          console.warn('⚠️ No step2 data to update in cafe schema');
        }
      } catch (step2UpdateError) {
        console.error('⚠️ Error updating cafe schema with step2 data:', step2UpdateError);
        console.error('Error details:', {
          message: step2UpdateError.message,
          stack: step2UpdateError.stack,
        });
        // Don't fail the request, just log the error
      }
    }
    
    // Update cafe schema when step3 is completed (PAN, GST, FSSAI, bank details)
    // Step3 data is stored in onboarding subdocument, no need to duplicate in main schema
    // as it's documentation/verification data, not display data
    if (finalCompletedSteps >= 3 && step3) {
      console.log('🔄 Step3 completed, data saved in onboarding subdocument...');
      console.log('📦 Step3 data received:', {
        hasPan: !!step3.pan,
        hasGst: !!step3.gst,
        hasFssai: !!step3.fssai,
        hasBank: !!step3.bank,
        panNumber: step3.pan?.panNumber,
        gstRegistered: step3.gst?.isRegistered,
        fssaiNumber: step3.fssai?.registrationNumber,
        bankAccount: step3.bank?.accountNumber,
      });
      console.log('✅ Step3 data saved in onboarding subdocument');
    }
    
    // Update cafe schema when step4 is completed (display data)
    if (finalCompletedSteps >= 4 && step4) {
      console.log('🔄 Step4 completed, updating cafe schema with step4 data...');
      console.log('📦 Step4 data received:', {
        estimatedDeliveryTime: step4.estimatedDeliveryTime,
        distance: step4.distance,
        priceRange: step4.priceRange,
        featuredDish: step4.featuredDish,
        featuredPrice: step4.featuredPrice,
        offer: step4.offer,
      });
      try {
        const updateData = {};
        if (step4.estimatedDeliveryTime !== undefined) {
          updateData.estimatedDeliveryTime = step4.estimatedDeliveryTime;
        }
        if (step4.distance !== undefined) {
          updateData.distance = step4.distance;
        }
        if (step4.priceRange !== undefined) {
          updateData.priceRange = step4.priceRange;
        }
        if (step4.featuredDish !== undefined) {
          updateData.featuredDish = step4.featuredDish;
        }
        if (step4.featuredPrice !== undefined) {
          updateData.featuredPrice = step4.featuredPrice;
        }
        if (step4.offer !== undefined) {
          updateData.offer = step4.offer;
        }
        
        if (Object.keys(updateData).length > 0) {
          const updated = await Cafe.findByIdAndUpdate(cafeId, { $set: updateData }, { new: true });
          console.log('✅ Cafe schema updated with step4 data:', {
            updatedFields: Object.keys(updateData),
            estimatedDeliveryTime: updated?.estimatedDeliveryTime,
            priceRange: updated?.priceRange,
            featuredDish: updated?.featuredDish,
          });
        } else {
          console.warn('⚠️ No step4 data to update in cafe schema');
        }
      } catch (step4UpdateError) {
        console.error('⚠️ Error updating cafe schema with step4 data:', step4UpdateError);
        // Don't fail the request, just log the error
      }
    }
    
    console.log('🔍 Onboarding update check:', {
      requestCompletedSteps: completedSteps,
      savedCompletedSteps: onboarding.completedSteps,
      finalCompletedSteps,
      hasStep1: !!step1,
      hasStep2: !!step2,
      hasStep3: !!step3,
      hasStep4: !!step4,
      cafeId: cafeId.toString(),
      willUpdateCafe: finalCompletedSteps === 4,
    });
    
    // Update cafe with final data if onboarding is complete (step 4)
    // Also check if step4 is being sent (which means user is completing step 4)
    // Note: Individual step updates are handled above, this is for final consolidation
    if (finalCompletedSteps === 4 || (step4 && completedSteps === 4)) {
      console.log('✅ Onboarding is complete (step 4), finalizing cafe data...');
      
      // All individual steps have already updated the cafe schema above
      // This section is kept for backward compatibility and final validation
      
      // Fetch the complete cafe to verify all data is saved
      const completeCafe = await Cafe.findById(cafeId).lean();
      
      console.log('📋 Final cafe data verification:', {
        name: completeCafe?.name,
        cuisines: completeCafe?.cuisines?.length || 0,
        openDays: completeCafe?.openDays?.length || 0,
        hasProfileImage: !!completeCafe?.profileImage,
        menuImagesCount: completeCafe?.menuImages?.length || 0,
        estimatedDeliveryTime: completeCafe?.estimatedDeliveryTime,
        priceRange: completeCafe?.priceRange,
      });
      
      // Return success response with cafe info
      return successResponse(res, 200, 'Onboarding data saved and cafe updated', {
        onboarding,
        cafe: {
          cafeId: completeCafe?.cafeId,
          _id: completeCafe?._id,
          name: completeCafe?.name,
          slug: completeCafe?.slug,
          isActive: completeCafe?.isActive,
        },
      });
    }

    return successResponse(res, 200, 'Onboarding data saved', {
      onboarding,
    });
  } catch (error) {
    console.error('Error saving cafe onboarding:', error);
    return errorResponse(res, 500, 'Failed to save onboarding data');
  }
};

// Manual trigger to update cafe from onboarding (for debugging/fixing)
export const createCafeFromOnboardingManual = async (req, res) => {
  try {
    const cafeId = req.cafe._id;
    
    // Fetch the complete cafe with onboarding data
    const cafe = await Cafe.findById(cafeId).lean();
    
    if (!cafe) {
      return errorResponse(res, 404, 'Cafe not found');
    }
    
    if (!cafe.onboarding) {
      return errorResponse(res, 404, 'Onboarding data not found');
    }
    
    if (!cafe.onboarding.step1 || !cafe.onboarding.step2) {
      return errorResponse(res, 400, 'Incomplete onboarding data. Please complete all steps first.');
    }
    
    if (cafe.onboarding.completedSteps !== 3) {
      return errorResponse(res, 400, `Onboarding not complete. Current step: ${cafe.onboarding.completedSteps}/3`);
    }
    
    try {
      const updatedCafe = await createCafeFromOnboarding(cafe.onboarding, cafeId);
      
      return successResponse(res, 200, 'Cafe updated successfully', {
        cafe: {
          cafeId: updatedCafe.cafeId,
          _id: updatedCafe._id,
          name: updatedCafe.name,
          slug: updatedCafe.slug,
          isActive: updatedCafe.isActive,
        },
      });
    } catch (error) {
      console.error('Error updating cafe:', error);
      return errorResponse(res, 500, `Failed to update cafe: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in createCafeFromOnboardingManual:', error);
    return errorResponse(res, 500, 'Failed to process request');
  }
};


