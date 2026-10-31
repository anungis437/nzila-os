-- Rollback for 0047_ml_prediction_feedback: the table holds recorded outcomes of predictions; export them first if they are wanted.
DROP TABLE IF EXISTS public.ml_prediction_feedback;
