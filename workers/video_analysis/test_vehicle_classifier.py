import unittest
from vehicle_classifier import decide,PROMPTS
class VehicleClassifierTests(unittest.TestCase):
 def test_three_business_shapes_and_internal_rejection(self):self.assertEqual(list(PROMPTS),['SEDAN','SUV','FULL_SIZE_SUV','OTHER'])
 def test_does_not_force_ambiguous_suv_into_four_by_four(self):self.assertEqual(decide({'SEDAN':.21,'SUV':.28,'FULL_SIZE_SUV':.29,'OTHER':.19})['category'],'UNKNOWN')
 def test_abstains_for_unrelated_or_obscured_vehicles(self):self.assertEqual(decide({'SEDAN':.25,'SUV':.27,'FULL_SIZE_SUV':.26,'OTHER':.35})['category'],'UNKNOWN')
 def test_strong_body_shape_is_not_drivetrain_claim(self):
  result=decide({'SEDAN':.3,'SUV':.24,'FULL_SIZE_SUV':.23,'OTHER':.19});self.assertEqual(result['category'],'SEDAN');self.assertTrue(result['requiresReview']);self.assertEqual(result['meaning'],'BODY_SHAPE_NOT_DRIVETRAIN')
if __name__=='__main__':unittest.main()
