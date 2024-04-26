import { Test, TestingModule } from '@nestjs/testing';
import { SurveyService } from './survey.service';
import { DeepMockProxy } from 'jest-mock-extended';
import {
  Form,
  PrismaClient,
  FormType,
  Question,
  Option,
  User,
  Alumni,
  Response,
  QuestionType,
  Answer,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateSurveyDTO,
  OptionDTO,
  QuestionDTO,
  EditSurveyDTO,
  ExistingQuestionDTO,
  ExistingOptionDTO,
} from './DTO/SurveyDTO';
import { createPrismaMock } from 'src/prisma/prisma.mock';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FillSurveyDTO } from './DTO/FIllSurveyDTO';

describe('SurveyService', () => {
  let surveyService: SurveyService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurveyService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    surveyService = module.get<SurveyService>(SurveyService);
  });

  const mockOption: Option[] = [
    {
      id: 'uuid',
      questionId: 'uuid',
      label: 'label',
      order: 1,
    },
  ];

  const optionRadio1: OptionDTO = {
    label: 'Option Radio 1',
    order: 1,
  };

  const optionRadio2: OptionDTO = {
    label: 'Option Radio 2',
    order: 2,
  };

  const existingOptionRadio1: ExistingOptionDTO = {
    id: 'uuid',
    ...optionRadio1,
    order: 3,
  };

  const existingOptionRadio2: ExistingOptionDTO = {
    id: 'uuid',
    ...optionRadio2,
    order: 4,
  };

  const optionCheckbox1: OptionDTO = {
    label: 'Option Checkbox 1',
    order: 1,
  };

  const optionCheckbox2: OptionDTO = {
    label: 'Option Checkbox 2',
    order: 2,
  };

  const questionText: QuestionDTO = {
    type: 'TEXT',
    question: 'Question Text',
    order: 1,
  };

  const questionRadio: QuestionDTO = {
    type: 'RADIO',
    question: 'Question Radio',
    order: 2,
    options: [optionRadio1, optionRadio2],
  };

  const questionCheckbox: QuestionDTO = {
    type: 'CHECKBOX',
    question: 'Question Checkbox',
    order: 3,
    options: [optionCheckbox1, optionCheckbox2],
  };

  const questionRange: QuestionDTO = {
    type: 'RANGE',
    question: 'Question Range',
    rangeFrom: 1,
    rangeTo: 5,
    order: 4,
  };

  const createSurveyDTO: CreateSurveyDTO = {
    type: 'CURRICULUM',
    title: 'title',
    description: 'description',
    startTime: new Date(2024, 0, 1),
    endTime: new Date(2024, 1, 1),
    questions: [questionText, questionRadio, questionCheckbox, questionRange],
  };

  const existingQuestionText: ExistingQuestionDTO = {
    id: 'uuid',
    ...questionText,
  };

  const existingQuestionRadio: ExistingQuestionDTO = {
    id: 'uuid',
    type: 'RADIO',
    question: 'Question Radio',
    order: 2,
    newOptions: [optionRadio1, optionRadio2],
  };

  const existingQuestionCheckbox: ExistingQuestionDTO = {
    id: 'uuid',
    type: 'CHECKBOX',
    question: 'Question Checkbox',
    order: 3,
    newOptions: [optionCheckbox1, optionCheckbox2],
    updateOptions: [existingOptionRadio1, existingOptionRadio2],
    deleteOptions: [{ id: 'uuid' }],
  };

  const existingQuestionRange: ExistingQuestionDTO = {
    id: 'uuid',
    ...questionRange,
  };

  const newQuestionText: QuestionDTO = {
    ...questionText,
    order: 5,
  };

  const newQuestionRadio: QuestionDTO = {
    ...questionRadio,
    order: 6,
  };

  const newQuestionCheckbox: QuestionDTO = {
    ...questionCheckbox,
    order: 7,
  };

  const newQuestionRange: QuestionDTO = {
    ...questionRange,
    order: 8,
  };
  const surveyId = 'b3eb1541-79cb-432f-a1fb-2101044eff81';

  const editSurveyDTO: EditSurveyDTO = {
    title: 'title',
    type: 'CAREER',
    description: 'description',
    startTime: new Date(2024, 0, 1),
    endTime: new Date(2024, 1, 1),
    newQuestions: [
      newQuestionText,
      newQuestionRadio,
      newQuestionCheckbox,
      newQuestionRange,
    ],
    updateQuestions: [
      existingQuestionText,
      existingQuestionRange,
      existingQuestionRadio,
      existingQuestionCheckbox,
    ],
    deleteQuestions: [{ id: 'uuid' }],
  };

  const surveyTest: Form = {
    id: 'ba20eb7a-8667-4a82-a18d-47aca6cf84ef',
    type: 'CURRICULUM',
    title: 'Test Survey',
    description: 'This is a testing survey',
    startTime: new Date(2024, 1, 2),
    endTime: new Date(2024, 2, 2),
    admissionYearFrom: 2019,
    admissionYearTo: 2019,
    graduateYearFrom: 2023,
    graduateYearTo: 2023,
  };

  describe('create survey', () => {
    it('should create survey successfully', async () => {
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const prismaMockTx = createPrismaMock();
        prismaMockTx.form.create.mockResolvedValue({ id: 'id' } as Form);
        await callback(prismaMockTx);
      });

      await surveyService.createSurvey(createSurveyDTO);
    });

    it('should validate start and end time', async () => {
      const createSurveyDTOWithInvalidTime: CreateSurveyDTO = {
        ...createSurveyDTO,
        startTime: new Date(2024, 1, 1),
        endTime: new Date(2024, 0, 1),
      };

      await expect(
        surveyService.createSurvey(createSurveyDTOWithInvalidTime),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate admission year', async () => {
      const createSurveyDTOWithInvalidAdmissionYear: CreateSurveyDTO = {
        ...createSurveyDTO,
        admissionYearFrom: 2024,
        admissionYearTo: 2023,
      };

      await expect(
        surveyService.createSurvey(createSurveyDTOWithInvalidAdmissionYear),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate graduate year', async () => {
      const createSurveyDTOWithInvalidGraduateYear: CreateSurveyDTO = {
        ...createSurveyDTO,
        graduateYearFrom: 2024,
        graduateYearTo: 2023,
      };

      await expect(
        surveyService.createSurvey(createSurveyDTOWithInvalidGraduateYear),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate question order', async () => {
      const createSurveyDTOWithInvalidQuestionOrder: CreateSurveyDTO = {
        ...createSurveyDTO,
        questions: [
          questionText,
          questionRadio,
          questionCheckbox,
          { ...questionRange, order: 1 },
        ],
      };

      await expect(
        surveyService.createSurvey(createSurveyDTOWithInvalidQuestionOrder),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate radio option', async () => {
      const createSurveyDTOWithNoRadioOption: CreateSurveyDTO = {
        ...createSurveyDTO,
        questions: [
          questionText,
          { ...questionRadio, options: [] },
          questionCheckbox,
          questionRange,
        ],
      };

      await expect(
        surveyService.createSurvey(createSurveyDTOWithNoRadioOption),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate checkbox option', async () => {
      const createSurveyDTOWithNoCheckboxOption: CreateSurveyDTO = {
        ...createSurveyDTO,
        questions: [
          questionText,
          questionRadio,
          { ...questionCheckbox, options: [] },
          questionRange,
        ],
      };

      await expect(
        surveyService.createSurvey(createSurveyDTOWithNoCheckboxOption),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate option order', async () => {
      const createSurveyDTOWithInvalidOptionOrder: CreateSurveyDTO = {
        ...createSurveyDTO,
        questions: [
          questionText,
          {
            ...questionRadio,
            options: [optionRadio1, { ...optionRadio2, order: 1 }],
          },
          questionCheckbox,
          questionRange,
        ],
      };

      await expect(
        surveyService.createSurvey(createSurveyDTOWithInvalidOptionOrder),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate rangeFrom and rangeTo', async () => {
      const createSurveyDTOWithoutRange: CreateSurveyDTO = {
        ...createSurveyDTO,
        questions: [
          questionText,
          questionRadio,
          questionCheckbox,
          { ...questionRange, rangeFrom: undefined, rangeTo: undefined },
        ],
      };

      await expect(
        surveyService.createSurvey(createSurveyDTOWithoutRange),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate range', async () => {
      const createSurveyDTOWithInvalidRange: CreateSurveyDTO = {
        ...createSurveyDTO,
        questions: [
          questionText,
          questionRadio,
          questionCheckbox,
          { ...questionRange, rangeFrom: 5, rangeTo: 1 },
        ],
      };

      await expect(
        surveyService.createSurvey(createSurveyDTOWithInvalidRange),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });
  });

  describe('edit survey', () => {
    it('should edit survey successfully', async () => {
      prismaMock.option.findMany.mockResolvedValue(mockOption);
      const mockQuestion: Question[] = [
        {
          id: 'uuid',
          type: 'RANGE',
          question: 'question',
          rangeFrom: 1,
          rangeTo: 5,
          order: 1,
          formId: 'uuid',
        },
      ];
      prismaMock.question.findMany.mockResolvedValue(mockQuestion);
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const prismaMockTx = createPrismaMock();
        prismaMockTx.form.update.mockResolvedValue({ id: 'id' } as Form);
        await callback(prismaMockTx);
      });

      await surveyService.editSurvey(surveyId, editSurveyDTO);
    });

    it('should check if the updated or deleted option exists in the updated question', async () => {
      prismaMock.option.findMany.mockResolvedValue([]);

      await expect(
        surveyService.editSurvey(surveyId, editSurveyDTO),
      ).rejects.toThrow(BadRequestException);
    });

    it('should check if the updated or deleted question exists in the form', async () => {
      prismaMock.option.findMany.mockResolvedValue(mockOption);
      prismaMock.question.findMany.mockResolvedValue([]);
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const prismaMockTx = createPrismaMock();
        await callback(prismaMockTx);
      });

      await expect(
        surveyService.editSurvey(surveyId, editSurveyDTO),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate start and end time', async () => {
      const editSurveyDTOWithInvalidTime: EditSurveyDTO = {
        ...editSurveyDTO,
        startTime: new Date(2024, 1, 1),
        endTime: new Date(2024, 0, 1),
      };

      await expect(
        surveyService.editSurvey(surveyId, editSurveyDTOWithInvalidTime),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate admission year', async () => {
      const editSurveyDTOWithInvalidAdmissionYear: EditSurveyDTO = {
        ...editSurveyDTO,
        admissionYearFrom: 2024,
        admissionYearTo: 2023,
      };

      await expect(
        surveyService.editSurvey(
          surveyId,
          editSurveyDTOWithInvalidAdmissionYear,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate graduate year', async () => {
      const editSurveyDTOWithInvalidGraduateYear: EditSurveyDTO = {
        ...editSurveyDTO,
        graduateYearFrom: 2024,
        graduateYearTo: 2023,
      };

      await expect(
        surveyService.editSurvey(
          surveyId,
          editSurveyDTOWithInvalidGraduateYear,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate question order', async () => {
      const editSurveyDTOWithInvalidQuestionOrder: EditSurveyDTO = {
        ...editSurveyDTO,
        newQuestions: [
          questionText,
          questionRadio,
          questionCheckbox,
          { ...questionRange, order: 1 },
        ],
      };

      await expect(
        surveyService.editSurvey(
          surveyId,
          editSurveyDTOWithInvalidQuestionOrder,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate existing question order', async () => {
      const editSurveyDTOWithInvalidQuestionOrder: EditSurveyDTO = {
        ...editSurveyDTO,
        newQuestions: [questionText, questionRadio, questionCheckbox],
        updateQuestions: [{ ...existingQuestionRange, order: 1 }],
      };

      await expect(
        surveyService.editSurvey(
          surveyId,
          editSurveyDTOWithInvalidQuestionOrder,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate new radio option', async () => {
      const editSurveyDTOWithNoRadioOption: EditSurveyDTO = {
        ...editSurveyDTO,
        newQuestions: [
          questionText,
          { ...questionRadio, options: [] },
          questionCheckbox,
          questionRange,
        ],
      };

      await expect(
        surveyService.editSurvey(surveyId, editSurveyDTOWithNoRadioOption),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate existing radio option', async () => {
      const editSurveyDTOWithNoRadioOption: EditSurveyDTO = {
        ...editSurveyDTO,
        newQuestions: [],
        updateQuestions: [
          existingQuestionText,
          { ...existingQuestionRadio, newOptions: [], updateOptions: [] },
          existingQuestionCheckbox,
          existingQuestionRange,
        ],
      };

      await expect(
        surveyService.editSurvey(surveyId, editSurveyDTOWithNoRadioOption),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate new checkbox option', async () => {
      const editSurveyDTOWithNoCheckboxOption: EditSurveyDTO = {
        ...editSurveyDTO,
        newQuestions: [
          questionText,
          questionRadio,
          { ...questionCheckbox, options: [] },
          questionRange,
        ],
      };

      await expect(
        surveyService.editSurvey(surveyId, editSurveyDTOWithNoCheckboxOption),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate existing checkbox option', async () => {
      prismaMock.option.findMany.mockResolvedValue(mockOption);
      const editSurveyDTOWithNoCheckboxOption: EditSurveyDTO = {
        ...editSurveyDTO,
        newQuestions: [],
        updateQuestions: [
          existingQuestionText,
          existingQuestionRadio,
          { ...existingQuestionCheckbox, newOptions: [], updateOptions: [] },
          existingQuestionRange,
        ],
      };

      await expect(
        surveyService.editSurvey(surveyId, editSurveyDTOWithNoCheckboxOption),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate option order of a new question', async () => {
      const editSurveyDTOWithInvalidOptionOrder: EditSurveyDTO = {
        ...editSurveyDTO,
        newQuestions: [
          questionText,
          {
            ...questionRadio,
            options: [optionRadio1, { ...optionRadio2, order: 1 }],
          },
          questionCheckbox,
          questionRange,
        ],
      };

      await expect(
        surveyService.editSurvey(surveyId, editSurveyDTOWithInvalidOptionOrder),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate option order of an existing question', async () => {
      const editSurveyDTOWithInvalidOptionOrder: EditSurveyDTO = {
        ...editSurveyDTO,
        newQuestions: [],
        updateQuestions: [
          existingQuestionText,
          {
            ...existingQuestionRadio,
            newOptions: undefined,
            updateOptions: [
              existingOptionRadio1,
              { ...existingOptionRadio2, order: 3 },
            ],
          },
          existingQuestionCheckbox,
          existingQuestionRange,
        ],
      };

      await expect(
        surveyService.editSurvey(surveyId, editSurveyDTOWithInvalidOptionOrder),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate rangeFrom and rangeTo of a new question', async () => {
      const editSurveyDTOWithoutRange: EditSurveyDTO = {
        ...editSurveyDTO,
        newQuestions: [
          questionText,
          questionRadio,
          questionCheckbox,
          { ...questionRange, rangeFrom: undefined, rangeTo: undefined },
        ],
      };

      await expect(
        surveyService.editSurvey(surveyId, editSurveyDTOWithoutRange),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate rangeFrom and rangeTo of an existing question', async () => {
      prismaMock.option.findMany.mockResolvedValue(mockOption);
      const editSurveyDTOWithoutRange: EditSurveyDTO = {
        ...editSurveyDTO,
        updateQuestions: [
          existingQuestionText,
          existingQuestionRadio,
          existingQuestionCheckbox,
          {
            ...existingQuestionRange,
            rangeFrom: undefined,
            rangeTo: undefined,
          },
        ],
      };

      await expect(
        surveyService.editSurvey(surveyId, editSurveyDTOWithoutRange),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate range of a new question', async () => {
      const editSurveyDTOWithInvalidRange: EditSurveyDTO = {
        ...editSurveyDTO,
        newQuestions: [
          questionText,
          questionRadio,
          questionCheckbox,
          { ...questionRange, rangeFrom: 5, rangeTo: 1 },
        ],
      };

      await expect(
        surveyService.editSurvey(surveyId, editSurveyDTOWithInvalidRange),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    it('should validate range of an existing question', async () => {
      prismaMock.option.findMany.mockResolvedValue(mockOption);
      const editSurveyDTOWithInvalidRange: EditSurveyDTO = {
        ...editSurveyDTO,
        updateQuestions: [
          existingQuestionText,
          existingQuestionRadio,
          existingQuestionCheckbox,
          { ...existingQuestionRange, rangeFrom: 5, rangeTo: 1 },
        ],
      };

      await expect(
        surveyService.editSurvey(surveyId, editSurveyDTOWithInvalidRange),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).toBeCalledTimes(0);
    });

    describe('delete', () => {
      const id = surveyTest.id;
      const nonExistentId = '5e2633ba-435d-41e8-8432-efa2832ce564';
      const invalidUUID = 'invalid-uuid';

      it('should successfully delete a survey', async () => {
        prismaMock.form.findUnique.mockResolvedValue(surveyTest);
        prismaMock.form.delete.mockResolvedValue(surveyTest);

        expect(await surveyService.deleteSurvey(id)).toEqual(id);
        expect(prismaMock.form.delete).toHaveBeenCalledWith({
          where: {
            id: surveyTest.id,
          },
        });
      });

      it('should throw NotFoundException if survey is not found', async () => {
        prismaMock.form.findUnique.mockResolvedValue(null);

        await expect(surveyService.deleteSurvey(nonExistentId)).rejects.toThrow(
          NotFoundException,
        );
        expect(prismaMock.form.delete).toHaveBeenCalledTimes(0);
      });

      it('should throw BadRequestException if ID is not a valid UUID', async () => {
        await expect(surveyService.deleteSurvey(invalidUUID)).rejects.toThrow(
          BadRequestException,
        );
      });

      it("should not delete a survey if the current date is within the survey's active period", async () => {
        jest.useFakeTimers().setSystemTime(new Date(2024, 1, 15));

        prismaMock.form.findUnique.mockResolvedValue(surveyTest);

        await expect(surveyService.deleteSurvey(id)).rejects.toThrow(
          BadRequestException,
        );

        expect(prismaMock.form.delete).toHaveBeenCalledTimes(0);

        jest.useRealTimers();
      });
    });
  });

  describe('get survey', () => {
    const option = [
      {
        id: 'da20eb7a-8667-4a82-a18d-47aca6cf84ef',
        label: '21',
        questionId: 'ca20eb7a-8667-4a82-a18d-47aca6cf84ef',
        order: 0,
      },
    ];

    const question = [
      {
        id: 'ca20eb7a-8667-4a82-a18d-47aca6cf84ef',
        type: 'RADIO',
        question: 'What is 9 + 10',
        order: 0,
        formId: 'ba20eb7a-8667-4a82-a18d-47aca6cf84ef',
        rangeFrom: null,
        rangeTo: null,
        options: option,
      },
    ];

    const survey = {
      id: 'ba20eb7a-8667-4a82-a18d-47aca6cf84ef',
      type: FormType.CURRICULUM,
      title: 'Test Survey',
      description: 'This is a testing survey',
      startTime: new Date(2024, 1, 2),
      endTime: new Date(2024, 2, 2),
      admissionYearFrom: 2019,
      admissionYearTo: 2019,
      graduateYearFrom: 2023,
      graduateYearTo: 2023,
      questions: question,
    };

    const nonExistentId = '5e2633ba-435d-41e8-8432-efa2832ce564';
    const invalidUUID = 'invalid-uuid';

    it('should return a survey', async () => {
      prismaMock.form.findUnique.mockResolvedValue(survey);

      expect(await surveyService.getSurvey(survey.id)).toEqual(survey);
      expect(prismaMock.form.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.form.findUnique).toHaveBeenCalledWith({
        where: {
          id: survey.id,
        },
        include: {
          questions: {
            orderBy: {
              order: 'asc',
            },
            include: {
              options: {
                orderBy: {
                  order: 'asc',
                },
              },
            },
          },
        },
      });
    });

    it('should throw NotFoundException if survey is not found', async () => {
      prismaMock.form.findUnique.mockResolvedValue(null);

      await expect(surveyService.getSurvey(nonExistentId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if ID is not a valid UUID', async () => {
      await expect(surveyService.getSurvey(invalidUUID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('get all surveys', () => {
    it('should return all surveys', async () => {
      const surveysMock = [surveyTest];

      prismaMock.form.findMany.mockResolvedValue(surveysMock);

      const result = await surveyService.getAllSurveys();

      expect(result).toEqual(surveysMock);
      expect(prismaMock.form.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAvailableSurveyByYear', () => {
    const startTime = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }),
    );
    const endTime = new Date(startTime.getDate() + 3);

    const survey = {
      id: '9999cca4-8997-4880-ac67-9768ede6e2a3',
      type: FormType.CURRICULUM,
      title: 'Test Survey',
      description: 'Test',
      startTime: startTime,
      endTime: endTime,
      admissionYearFrom: 2020,
      admissionYearTo: 2023,
      graduateYearFrom: 2024,
      graduateYearTo: 2027,
    };

    it('should return surveys for a given admission and graduate year within 7 days before start date and before end time', async () => {
      const admissionYear = '2020';
      const graduateYear = '2025';
      const surveysMock = [survey];

      prismaMock.form.findMany.mockResolvedValue(surveysMock);

      const result = await surveyService.getAvailableSurveyByYear(
        admissionYear,
        graduateYear,
      );

      expect(result).toEqual(surveysMock);
    });

    it('should throw BadRequestException if admissionYear or graduateYear is invalid', async () => {
      const admissionYear = 'invalid';
      const graduateYear = '2024';

      await expect(
        surveyService.getAvailableSurveyByYear(admissionYear, graduateYear),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.form.findMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if graduateYear is less than admissionYear', async () => {
      const admissionYear = '2025';
      const graduateYear = '2024';

      await expect(
        surveyService.getAvailableSurveyByYear(admissionYear, graduateYear),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.form.findMany).not.toHaveBeenCalled();
    });
  });

  describe('get survey for alumni', () => {
    const mockAlumni: Alumni = {
      id: 'ed036827-2df3-4c45-8323-0eb43627f7f1',
      phoneNo:
        '$2b$10$89KoyS3YtlCfSsfHiyZTN.WtVfnFZ9U/.nMeXDtqedgwDE0Mj8kvy|92d362f959534bab|fc54298b1aa9f0ca3bb3e0d997bc3685|000a68a2793d43b622eba0361b458d44',
      address:
        '$2b$10$89KoyS3YtlCfSsfHiyZTN.Y2yh6rIYemKlZchKh6gMZxXoNWaRYn.|3528eed66ca856ae|b3157b4ecd41ddc884e86e6b01d5129d|6b96c85f4e36a2783045980c4bc6293a9fb29c7206b15cae60301c45aabbf41b48d1adcc6eddedd5e9cf2b77992bb491f67e2dfe473f3e1283a02bc7f8412ae7cacd7a24671b2e8e48579e42d7e50209',
      gender: 'MALE',
      enrollmentYear: 1995,
      graduateYear: 1999,
      studyProgramId: '2fa34067-d271-4ea4-9074-dedb3c99cb3a',
      npm: '1312452141',
    };

    const mockUser: User & { alumni: Alumni } = {
      id: '287ed51b-df85-43ab-96a3-13bb513e68c5',
      email: 'email@email.com',
      password: 'currentPassword',
      name: 'user',
      role: 'ALUMNI',
      alumni: mockAlumni,
    };

    const mockSurvey = {
      id: '9423bbe7-f14f-4b02-8654-b15b1c163341',
      type: 'CURRICULUM',
      title: 'test normal',
      description: 'normal',
      startTime: new Date('2024-04-02T12:56:00.000Z'),
      endTime: new Date('2025-04-02T12:57:00.000Z'),
      admissionYearFrom: null,
      admissionYearTo: null,
      graduateYearFrom: null,
      graduateYearTo: null,
    };

    const nonExistentId = '5e2633ba-435d-41e8-8432-efa2832ce564';
    const invalidUUID = 'invalid-uuid';

    it('should return a survey', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      prismaMock.alumni.findUnique.mockResolvedValue(mockAlumni);
      prismaMock.form.findUnique.mockResolvedValue({
        id: '9423bbe7-f14f-4b02-8654-b15b1c163341',
        type: 'CURRICULUM',
        title: 'test normal',
        description: 'normal',
        startTime: new Date('2024-04-02T12:56:00.000Z'),
        endTime: new Date('2025-04-02T12:57:00.000Z'),
        admissionYearFrom: null,
        admissionYearTo: null,
        graduateYearFrom: null,
        graduateYearTo: null,
      });

      expect(
        await surveyService.getSurveyForFill(mockSurvey.id, 'test@gmail.com'),
      ).toEqual(mockSurvey);
      expect(prismaMock.form.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.form.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockSurvey.id,
        },
        include: {
          questions: {
            include: {
              options: {
                orderBy: {
                  order: 'asc',
                },
              },
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
      });
    });

    it('should throw NotFoundException if survey is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.alumni.findUnique.mockResolvedValue(mockAlumni);
      await expect(
        surveyService.getSurveyForFill(nonExistentId, 'test@gmail.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if ID is not a valid UUID', async () => {
      await expect(
        surveyService.getSurveyForFill(invalidUUID, 'test@gmail.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('no email', async () => {
      await expect(
        surveyService.getUserByEmail('test@gmail.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('no alumni', async () => {
      await expect(
        surveyService.getAlumni({
          id: '123',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('no alumni with Id', async () => {
      await expect(surveyService.getAlumni(mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('the form is not availble now', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.alumni.findUnique.mockResolvedValue(mockAlumni);
      prismaMock.form.findUnique.mockResolvedValue({
        id: '9423bbe7-f14f-4b02-8654-b15b1c163341',
        type: 'CURRICULUM',
        title: 'test normal',
        description: 'normal',
        startTime: new Date('2024-04-02T12:56:00.000Z'),
        endTime: new Date('2024-04-02T12:57:00.000Z'),
        admissionYearFrom: null,
        admissionYearTo: null,
        graduateYearFrom: null,
        graduateYearTo: null,
      });

      await expect(
        surveyService.getSurveyForFill(mockSurvey.id, 'test@gmail.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('the form enrollment year didnt match', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.alumni.findUnique.mockResolvedValue(mockAlumni);
      prismaMock.form.findUnique.mockResolvedValue({
        id: '9423bbe7-f14f-4b02-8654-b15b1c163341',
        type: 'CURRICULUM',
        title: 'test normal',
        description: 'normal',
        startTime: new Date('2024-04-02T12:56:00.000Z'),
        endTime: new Date('2025-04-02T12:57:00.000Z'),
        admissionYearFrom: 1999,
        admissionYearTo: 2000,
        graduateYearFrom: null,
        graduateYearTo: null,
      });

      await expect(
        surveyService.getSurveyForFill(mockSurvey.id, 'test@gmail.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('the form graduate year didnt match', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.alumni.findUnique.mockResolvedValue(mockAlumni);
      prismaMock.form.findUnique.mockResolvedValue({
        id: '9423bbe7-f14f-4b02-8654-b15b1c163341',
        type: 'CURRICULUM',
        title: 'test normal',
        description: 'normal',
        startTime: new Date('2024-04-02T12:56:00.000Z'),
        endTime: new Date('2025-04-02T12:57:00.000Z'),
        admissionYearFrom: null,
        admissionYearTo: null,
        graduateYearFrom: 2001,
        graduateYearTo: null,
      });

      await expect(
        surveyService.getSurveyForFill(mockSurvey.id, 'test@gmail.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('alumni have filled the same form', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.alumni.findUnique.mockResolvedValue(mockAlumni);
      prismaMock.form.findUnique.mockResolvedValue({
        id: '9423bbe7-f14f-4b02-8654-b15b1c163341',
        type: 'CURRICULUM',
        title: 'test normal',
        description: 'normal',
        startTime: new Date('2024-04-02T12:56:00.000Z'),
        endTime: new Date('2025-04-02T12:57:00.000Z'),
        admissionYearFrom: null,
        admissionYearTo: null,
        graduateYearFrom: null,
        graduateYearTo: null,
      });
      prismaMock.response.findFirst.mockResolvedValue({
        id: 'hehe',
        formId: 'hehe',
        alumniId: 'jeje',
      });

      await expect(
        surveyService.getSurveyForFill(mockSurvey.id, 'test@gmail.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('fill survey', () => {
    const mockAlumni: Alumni = {
      id: 'ed036827-2df3-4c45-8323-0eb43627f7f1',
      phoneNo:
        '$2b$10$89KoyS3YtlCfSsfHiyZTN.WtVfnFZ9U/.nMeXDtqedgwDE0Mj8kvy|92d362f959534bab|fc54298b1aa9f0ca3bb3e0d997bc3685|000a68a2793d43b622eba0361b458d44',
      address:
        '$2b$10$89KoyS3YtlCfSsfHiyZTN.Y2yh6rIYemKlZchKh6gMZxXoNWaRYn.|3528eed66ca856ae|b3157b4ecd41ddc884e86e6b01d5129d|6b96c85f4e36a2783045980c4bc6293a9fb29c7206b15cae60301c45aabbf41b48d1adcc6eddedd5e9cf2b77992bb491f67e2dfe473f3e1283a02bc7f8412ae7cacd7a24671b2e8e48579e42d7e50209',
      gender: 'MALE',
      enrollmentYear: 1995,
      graduateYear: 1999,
      studyProgramId: '2fa34067-d271-4ea4-9074-dedb3c99cb3a',
      npm: '1312452141',
    };

    const fillSurveyDTO: FillSurveyDTO = {
      'ini-id-question': 'ini jawaban',
    };

    const mockUser: User & { alumni: Alumni } = {
      id: '287ed51b-df85-43ab-96a3-13bb513e68c5',
      email: 'email@email.com',
      password: 'currentPassword',
      name: 'user',
      role: 'ALUMNI',
      alumni: mockAlumni,
    };

    it('success fill survey', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.alumni.findUnique.mockResolvedValue(mockAlumni);
      prismaMock.form.findUnique.mockResolvedValue({
        id: '9423bbe7-f14f-4b02-8654-b15b1c163341',
        type: 'CURRICULUM',
        title: 'test normal',
        description: 'normal',
        startTime: new Date('2024-04-02T12:56:00.000Z'),
        endTime: new Date('2025-04-02T12:57:00.000Z'),
        admissionYearFrom: null,
        admissionYearTo: null,
        graduateYearFrom: null,
        graduateYearTo: null,
      });
      prismaMock.question.findUnique.mockResolvedValue({
        id: 'id',
        type: QuestionType.TEXT,
        question: 'ini question',
        rangeFrom: null,
        rangeTo: null,
        order: 1,
        formId: '9423bbe7-f14f-4b02-8654-b15b1c163341',
      });

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const prismaMockTx = createPrismaMock();
        prismaMockTx.response.create.mockResolvedValue({
          id: 'id',
        } as Response);
        await callback(prismaMockTx);
      });

      await surveyService.fillSurvey(fillSurveyDTO, mockUser.email);
    });

    it('Question id is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.alumni.findUnique.mockResolvedValue(mockAlumni);
      prismaMock.form.findUnique.mockResolvedValue({
        id: '9423bbe7-f14f-4b02-8654-b15b1c163341',
        type: 'CURRICULUM',
        title: 'test normal',
        description: 'normal',
        startTime: new Date('2024-04-02T12:56:00.000Z'),
        endTime: new Date('2025-04-02T12:57:00.000Z'),
        admissionYearFrom: null,
        admissionYearTo: null,
        graduateYearFrom: null,
        graduateYearTo: null,
      });

      await expect(
        surveyService.fillSurvey(fillSurveyDTO, mockUser.email),
      ).rejects.toThrow(NotFoundException);
    });

    it('Survey with those question is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.alumni.findUnique.mockResolvedValue(mockAlumni);
      prismaMock.question.findUnique.mockResolvedValue({
        id: 'id',
        type: QuestionType.TEXT,
        question: 'ini question',
        rangeFrom: null,
        rangeTo: null,
        order: 1,
        formId: '9423bbe7-f14f-4b02-8654-b15b1c163341',
      });

      await expect(
        surveyService.fillSurvey(fillSurveyDTO, mockUser.email),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSurveyResponses', () => {
    it('should return survey responses including alumni and answers', async () => {
      const mockAlumni: Alumni = {
        id: 'b6e02c84-f321-4b4e-bff6-780c8cae17b3',
        phoneNo:
          '$2b$10$89KoyS3YtlCfSsfHiyZTN.HZjngo8VPgztWWHQHkM0A7JqpMuDWgm|b7adb2299b170577|b3b6620444be4ad38531d3eaae8924a4|5a015347e1321163988c75132dfbea5d',
        address:
          '$2b$10$89KoyS3YtlCfSsfHiyZTN.uBMnQX2lluICrEGO9kCMCrTk0NFlEDS|cd4f8f6c4b718dd5|5cad4e104c5c6f639d47a668bed256a2|7ac79c3c1744857d5cdbf1d948db5fbad37f01d68fba6bacb5cb50b409d29333',
        gender: 'FEMALE',
        enrollmentYear: 2021,
        graduateYear: 2024,
        studyProgramId: '393f6a47-425e-4402-92b6-782d266e0193',
        npm: '2106634331',
      };

      const mockSurvey = {
        id: '65259cd0-b2e2-4ac0-9dd2-847dbd79157b',
        type: FormType.CURRICULUM,
        title: 'Survey buat semua alumni',
        description: 'Survey Description',
        startTime: new Date('2024-03-24T17:00:00.000Z'),
        endTime: new Date('2024-04-24T20:15:00.000Z'),
        admissionYearFrom: null,
        admissionYearTo: null,
        graduateYearFrom: null,
        graduateYearTo: null,
      };

      const mockQuestion = {
        id: '14a4acdc-50b1-477f-90e9-8e0c99e85e58',
        type: 'TEXT',
        question: 'What is your name?',
        rangeFrom: null,
        rangeTo: null,
        order: 1,
        formId: mockSurvey.id,
      };

      const mockResponse: Response[] = [{
        id: 'dea1c841-f238-4619-914c-d8b3afe6d47c',
        formId: mockSurvey.id,
        alumniId: mockAlumni.id,
      }];

      const mockAnswer: Answer = {
        id: 'e1c3b99e-576b-4b81-976f-a949797de075',
        answer: 'john',
        responseId: mockResponse[0].id,
        questionId: mockQuestion.id,
      };

      prismaMock.form.findUnique.mockResolvedValue(mockSurvey);
      prismaMock.response.findMany.mockResolvedValue(mockResponse);

      const result = await surveyService.getSurveyResponses(surveyId);

      console.log(result);
      expect(result).toEqual(mockResponse);
      expect(prismaMock.form.findUnique).toHaveBeenCalledWith({
        where: { id: surveyId },
      });
      expect(prismaMock.response.findMany).toHaveBeenCalledWith({
        where: { formId: surveyId },
        include: {
          alumni: true,
          answers: {
            include: {
              question: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException if survey is not found', async () => {
      const surveyId = 'nonexistent-survey-id';

      prismaMock.form.findUnique.mockResolvedValue(null);

      await expect(
        surveyService.getSurveyResponses(surveyId),
      ).rejects.toThrowError(NotFoundException);

      expect(prismaMock.form.findUnique).toHaveBeenCalledWith({
        where: { id: surveyId },
      });

      expect(prismaMock.response.findMany).not.toHaveBeenCalled();
    });
  });
});
